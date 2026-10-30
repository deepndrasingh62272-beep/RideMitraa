"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Phone, Plus, Trash2, Users, AlertTriangle, Check } from "lucide-react";
import { toast } from "sonner";

interface Contact {
  id: string;
  name: string;
  phone: string;
}

export default function EmergencyContacts() {
  const [contacts, setContacts] = useState<Contact[]>([
    { id: "1", name: "Priya Sharma", phone: "+91 99887 76655" },
    { id: "2", name: "Raj Kumar", phone: "+91 88776 65544" },
  ]);
  const [isAdding, setIsAdding] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "" });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleAdd = () => {
    if (!newContact.name.trim()) {
      toast.error("Please enter contact name");
      return;
    }
    if (!newContact.phone.trim()) {
      toast.error("Please enter phone number");
      return;
    }
    if (contacts.length >= 3) {
      toast.error("Maximum 3 contacts allowed");
      return;
    }
    setContacts([...contacts, { id: Date.now().toString(), ...newContact }]);
    setNewContact({ name: "", phone: "" });
    setIsAdding(false);
    toast.success("Contact added!");
  };

  const handleRemove = (id: string) => {
    setContacts(contacts.filter(c => c.id !== id));
    toast.success("Contact removed");
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
            <AlertTriangle size={24} className="text-red-500" />
          </div>
          <div>
            <h3 className="text-lg font-black text-gray-900">Emergency Contacts</h3>
            <p className="text-xs text-gray-500">Click + to add, tap contact to call</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-3">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-red-200 transition-colors group"
          >
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-400 to-pink-500 flex items-center justify-center">
                <span className="text-sm font-bold text-white">
                  {contact.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">{contact.name}</p>
                <a href={`tel:${contact.phone}`} className="text-xs text-gray-500 flex items-center gap-1 hover:text-red-500">
                  <Phone size={10} />
                  {contact.phone}
                </a>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isMounted && (
                <>
                  <a
                    href={`tel:${contact.phone}`}
                    className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
                    suppressHydrationWarning
                  >
                    <Phone size={18} />
                  </a>
                  <button
                    onClick={() => handleRemove(contact.id)}
                    className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors"
                    suppressHydrationWarning
                  >
                    <Trash2 size={18} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}

        {contacts.length < 3 && !isAdding && isMounted && (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 font-bold text-sm hover:border-red-300 hover:text-red-500 transition-colors flex items-center justify-center gap-2"
            suppressHydrationWarning
          >
            <Plus size={18} />
            Add Emergency Contact
          </button>
        )}

        {isAdding && isMounted && (
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-gray-400" />
              <span className="text-xs text-gray-500 font-bold">New Contact ({contacts.length}/3)</span>
            </div>
            <input
              type="text"
              placeholder="Contact Name"
              value={newContact.name}
              onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm"
            />
            <input
              type="tel"
              placeholder="Phone Number"
              value={newContact.phone}
              onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewContact({ name: "", phone: "" });
                }}
                className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50"
                suppressHydrationWarning
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 flex items-center justify-center gap-2"
                suppressHydrationWarning
              >
                <Check size={16} />
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}