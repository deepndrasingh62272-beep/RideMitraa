"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Plus, Trash2, Phone, AlertTriangle,
  Check, X, MapPin, Send, Users
} from "lucide-react";
import { toast } from "sonner";

interface Contact {
  id: string;
  name: string;
  phone: string;
}

interface SosSettingsProps {
  isCompact?: boolean;
}

export default function SosSettings({ isCompact = false }: SosSettingsProps) {
  const [contacts, setContacts] = useState<Contact[]>([
    { id: "1", name: "Priya Sharma", phone: "+91 99887 76655" },
    { id: "2", name: "Raj Kumar", phone: "+91 88776 65544" },
  ]);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "" });

  // SOS State
  const [isSosActive, setIsSosActive] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(5);
  const [isSosTriggered, setIsSosTriggered] = useState(false);

  const handleAddContact = () => {
    if (contacts.length >= 3) {
      toast.error("Maximum 3 emergency contacts allowed");
      return;
    }
    if (!newContact.name || !newContact.phone) {
      toast.error("Please fill all fields");
      return;
    }
    setContacts([...contacts, { id: Date.now().toString(), ...newContact }]);
    setNewContact({ name: "", phone: "" });
    setIsAddingContact(false);
    toast.success("Emergency contact added!");
  };

  const handleRemoveContact = (id: string) => {
    setContacts(contacts.filter(c => c.id !== id));
    toast.success("Contact removed");
  };

  const handleStartSos = () => {
    setIsSosActive(true);
    setSosCountdown(5);

    const interval = setInterval(() => {
      setSosCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          triggerSos();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const triggerSos = () => {
    setIsSosTriggered(true);
    setIsSosActive(false);
    toast.error("SOS Alert Triggered!", {
      description: "Emergency services and your contacts have been notified.",
      duration: 10000,
    });
  };

  const handleCancelSos = () => {
    setIsSosActive(false);
    setSosCountdown(5);
    toast.info("SOS cancelled");
  };

  const handleResetSos = () => {
    setIsSosTriggered(false);
  };

  return (
    <div className={`bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden ${isCompact ? "p-6" : ""}`}>
      {!isCompact && (
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                <Shield size={24} className="text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">Safety Settings</h3>
                <p className="text-xs text-gray-500">Manage emergency contacts</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`${isCompact ? "" : "p-6"} space-y-6`}>
        {/* Trusted Contacts */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-gray-400" />
              <h4 className="text-sm font-black text-gray-900">Trusted Contacts</h4>
              <span className="text-[10px] text-gray-400">({contacts.length}/3)</span>
            </div>
            {contacts.length < 3 && (
              <button
                onClick={() => setIsAddingContact(true)}
                className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
              >
                <Plus size={14} />
                Add Contact
              </button>
            )}
          </div>

          {contacts.map((contact) => (
            <motion.div
              key={contact.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <span className="text-sm font-black text-blue-600">
                    {contact.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{contact.name}</p>
                  <p className="text-xs text-gray-500">{contact.phone}</p>
                </div>
              </div>
              <button
                onClick={() => handleRemoveContact(contact.id)}
                className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </motion.div>
          ))}

          {/* Add Contact Form */}
          <AnimatePresence>
            {isAddingContact && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 p-4 bg-gray-50 rounded-2xl border border-gray-100"
              >
                <input
                  type="text"
                  placeholder="Contact Name"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsAddingContact(false)}
                    className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddContact}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700"
                  >
                    Add Contact
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SOS Button */}
        <div className="pt-4 border-t border-gray-100">
          <AnimatePresence mode="wait">
            {!isSosActive && !isSosTriggered && (
              <motion.button
                key="sos-button"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStartSos}
                className="w-full py-5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-3xl font-black text-lg shadow-2xl shadow-red-500/30 flex items-center justify-center gap-3"
              >
                <AlertTriangle size={24} />
                Emergency SOS
              </motion.button>
            )}

            {isSosActive && (
              <motion.div
                key="sos-countdown"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="space-y-4 p-6 bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200 rounded-3xl"
              >
                <div className="text-center">
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <span className="text-4xl font-black text-red-600">{sosCountdown}</span>
                  </div>
                  <p className="text-sm font-bold text-red-700">
                    Sending SOS in {sosCountdown} seconds...
                  </p>
                  <p className="text-xs text-red-600/70 mt-1">
                    Live location will be shared with emergency contacts
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleCancelSos}
                    className="flex-1 py-4 bg-white border-2 border-gray-200 text-gray-700 rounded-2xl font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={triggerSos}
                    className="flex-1 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-2xl font-bold shadow-lg"
                  >
                    Send Now
                  </button>
                </div>
              </motion.div>
            )}

            {isSosTriggered && (
              <motion.div
                key="sos-triggered"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="space-y-4 p-6 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-3xl"
              >
                <div className="text-center">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check size={40} className="text-emerald-600" />
                  </div>
                  <h4 className="text-lg font-black text-emerald-900 mb-2">SOS Alert Sent!</h4>
                  <p className="text-sm text-emerald-700">
                    Emergency services and {contacts.length} trusted contact{contacts.length > 1 ? "s" : ""} have been notified with your live location.
                  </p>
                </div>
                <div className="bg-white/50 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <MapPin size={20} className="text-emerald-600 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-emerald-800">Location Shared</p>
                      <p className="text-xs text-emerald-600">12.9716° N, 77.5946° E</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleResetSos}
                  className="w-full py-3 bg-white border-2 border-emerald-200 text-emerald-700 rounded-2xl font-bold hover:bg-emerald-50"
                >
                  Reset SOS
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
