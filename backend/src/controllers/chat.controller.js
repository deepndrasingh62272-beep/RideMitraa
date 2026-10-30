const Chat           = require('../models/Chat');
const Message        = require('../models/Message');
const { emitChatMessage } = require('../config/socket');
const { sendRideMessage } = require('../services/chatRealtimeService');

const MESSAGES_PER_PAGE = 30;

// ─── Internal ─────────────────────────────────────────────────────────────────

/**
 * Called by booking controller when a booking is ACCEPTED.
 * Idempotent — safe to call multiple times for the same booking.
 */
const createChatForBooking = async (booking) => {
  const existing = await Chat.findOne({ bookingId: booking._id });
  if (existing) return existing;

  return Chat.create({
    bookingId:   booking._id,
    rideId:      booking.rideId,
    driverId:    booking.driverId,
    passengerId: booking.passengerId,
    unreadCount: {
      [booking.driverId.toString()]:    0,
      [booking.passengerId.toString()]: 0,
    },
  });
};

exports.createChatForBooking = createChatForBooking;

// ─── POST /api/chat/:rideId/send ──────────────────────────────────────────────
exports.sendMessage = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const { text, bookingId, eventId } = req.body;
    const senderId   = req.user._id;

    let sent;
    try {
      sent = await sendRideMessage({
        rideId,
        senderId,
        text,
        bookingId,
        eventId,
      });
    } catch (err) {
      if (err.code === 'MODERATION_BLOCKED') {
        return res.status(422).json({
          error: 'Message blocked by content moderation',
          categories: err.categories || [],
        });
      }
      throw err;
    }

    try {
      emitChatMessage(rideId, sent.payload);
    } catch {
      // Non-critical
    }

    res.status(201).json({ message: 'Message sent', data: sent.message });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/chat/:rideId/messages ───────────────────────────────────────────
exports.getMessages = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const { bookingId } = req.query;
    const userId     = req.user._id;
    const page       = parseInt(req.query.page  ?? 1);
    const limit      = parseInt(req.query.limit ?? MESSAGES_PER_PAGE);

    let chat;
    if (bookingId) {
      chat = await Chat.findOne({ rideId, bookingId });
    } else {
      const chats = await Chat.find({
        rideId,
        $or: [{ driverId: userId }, { passengerId: userId }],
      }).sort({ updatedAt: -1 }).limit(5);

      if (!chats.length)
        return res.status(404).json({ error: 'Chat not found for this ride' });

      const asDriver = chats.filter((c) => c.driverId.toString() === userId.toString());
      if (asDriver.length > 1) {
        return res.status(409).json({
          error: 'Multiple chats found for this ride. Pass bookingId query param.',
        });
      }

      chat = chats[0];
    }

    if (!chat) return res.status(404).json({ error: 'Chat not found for this ride' });

    const isParticipant =
      chat.driverId.toString()    === userId.toString() ||
      chat.passengerId.toString() === userId.toString();
    if (!isParticipant) return res.status(403).json({ error: 'Access denied' });

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      Message.find({ chatId: chat._id, isDeleted: false })
        .sort({ createdAt: -1 })   // newest first — client reverses for display
        .skip(skip)
        .limit(limit)
        .populate('senderId', 'name')
        .lean(),
      Message.countDocuments({ chatId: chat._id, isDeleted: false }),
    ]);

    // Mark all fetched messages as read by this user
    await Message.updateMany(
      { chatId: chat._id, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );

    // Reset unread counter for this user
    chat.unreadCount.set(userId.toString(), 0);
    await chat.save();

    res.json({
      total,
      page,
      pages:    Math.ceil(total / limit),
      messages: messages.reverse(), // chronological order
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/chat/conversations ──────────────────────────────────────
exports.getConversations = async (req, res, next) => {
  try {
    const userId = req.user._id.toString();

    const chats = await Chat.find({
      $or: [{ driverId: userId }, { passengerId: userId }],
    })
      .sort({ updatedAt: -1 })
      .populate('driverId',    'name phone')
      .populate('passengerId', 'name phone')
      .populate('rideId',      'schedule vehicle pickup dropoff')
      .lean();

    // Attach unread count for the requesting user
    const result = chats.map((c) => ({
      ...c,
      myUnread: c.unreadCount?.[userId] ?? 0,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
};
