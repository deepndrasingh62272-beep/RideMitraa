const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const BookingRequest = require('../models/BookingRequest');
const { moderateText } = require('../utils/moderation');

const ACTIVE_CHAT_BOOKING_STATUSES = new Set(['ACCEPTED', 'ONGOING']);

const toStatusError = (message, status = 400, extra = {}) =>
  Object.assign(new Error(message), { status, ...extra });

const normalizeId = (value) => String(value || '').trim();

// Validate MongoDB ObjectId
const isValidObjectId = (id) => {
  if (!id) return false;
  return mongoose.Types.ObjectId.isValid(id);
};

// Validate IDs before database operations
const validateIds = (rideId, bookingId) => {
  if (!rideId) {
    throw toStatusError('rideId is required', 400);
  }
  
  if (!isValidObjectId(rideId)) {
    throw toStatusError('Invalid rideId format', 400);
  }
  
  if (bookingId && !isValidObjectId(bookingId)) {
    throw toStatusError('Invalid bookingId format', 400);
  }
  
  return {
    rideId: normalizeId(rideId),
    bookingId: bookingId ? normalizeId(bookingId) : undefined
  };
};

const getParticipantFilter = (userId) => ({
  $or: [{ driverId: userId }, { passengerId: userId }],
});

const loadEligibleChats = async ({ rideId, userId, bookingId }) => {
  // Validate IDs first
  const { rideId: validatedRideId, bookingId: validatedBookingId } = validateIds(rideId, bookingId);
  
  // Validate userId
  if (!userId || !isValidObjectId(userId)) {
    throw toStatusError('Invalid userId', 400);
  }

  const query = {
    rideId: validatedRideId,
    ...getParticipantFilter(userId),
  };

  if (validatedBookingId) query.bookingId = validatedBookingId;

  const chats = await Chat.find(query).sort({ updatedAt: -1 });
  if (!chats.length) throw toStatusError('Chat not found for this ride', 404);

  const bookingIds = chats.map((c) => c.bookingId).filter(Boolean);
  const bookingRows = await BookingRequest.find({ _id: { $in: bookingIds } })
    .select('_id status')
    .lean();

  const statusByBooking = new Map(
    bookingRows.map((row) => [String(row._id), row.status])
  );

  const eligible = chats.filter((chat) => {
    const status = statusByBooking.get(String(chat.bookingId));
    return chat.isActive && ACTIVE_CHAT_BOOKING_STATUSES.has(status);
  });

  return { chats, eligible, statusByBooking };
};

const resolveChatForSend = async ({ rideId, senderId, bookingId }) => {
  const { eligible } = await loadEligibleChats({ rideId, userId: senderId, bookingId });

  if (!eligible.length) {
    throw toStatusError(
      'Chat is only available for ACCEPTED or ONGOING bookings',
      403
    );
  }

  if (bookingId) {
    const selected = eligible.find((c) => String(c.bookingId) === normalizeId(bookingId));
    if (!selected) {
      throw toStatusError(
        'Chat is only available for ACCEPTED or ONGOING bookings',
        403
      );
    }
    return selected;
  }

  const senderAsDriver = eligible.filter(
    (chat) => String(chat.driverId) === normalizeId(senderId)
  );

  if (senderAsDriver.length > 1) {
    throw toStatusError(
      'Multiple active chats for this ride. Provide bookingId.',
      409
    );
  }

  return eligible[0];
};

const assertRideChatAccess = async ({ rideId, userId, bookingId }) => {
  const { eligible } = await loadEligibleChats({ rideId, userId, bookingId });
  if (!eligible.length) {
    throw toStatusError(
      'Chat is only available for ACCEPTED or ONGOING bookings',
      403
    );
  }

  return true;
};

const sendRideMessage = async ({
  rideId,
  senderId,
  text,
  bookingId,
  eventId,
}) => {
  const normalizedText = String(text || '').trim();
  if (!normalizedText) throw toStatusError('Message text is required', 400);
  if (normalizedText.length > 1000)
    throw toStatusError('Message too long (max 1000 chars)', 400);

  const chat = await resolveChatForSend({ rideId, senderId, bookingId });

  const moderation = await moderateText(normalizedText);
  if (moderation.flagged) {
    throw toStatusError('Message blocked by content moderation', 422, {
      code: 'MODERATION_BLOCKED',
      categories: moderation.categories,
    });
  }

  const message = await Message.create({
    chatId: chat._id,
    rideId,
    senderId,
    text: normalizedText,
    moderation,
    readBy: [senderId],
  });

  const otherId =
    String(chat.driverId) === normalizeId(senderId)
      ? String(chat.passengerId)
      : String(chat.driverId);

  const currentUnread = chat.unreadCount.get(otherId) ?? 0;
  chat.unreadCount.set(otherId, currentUnread + 1);
  chat.lastMessage = {
    text: normalizedText,
    senderId,
    sentAt: message.createdAt,
  };
  await chat.save();

  const payload = {
    eventId: eventId || String(message._id),
    messageId: message._id,
    chatId: chat._id,
    bookingId: chat.bookingId,
    rideId: String(chat.rideId),
    senderId,
    text: normalizedText,
    sentAt: message.createdAt,
  };

  return { chat, message, payload };
};

module.exports = {
  sendRideMessage,
  assertRideChatAccess,
};
