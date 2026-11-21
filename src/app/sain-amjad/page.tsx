"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Header } from "@/components/layout/Header";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { SainAmjadEntry, SainAmjadEntryType } from "@/types/database";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  DollarSign,
  Loader2,
  Plus,
  Minus,
  Trash2,
  X,
} from "lucide-react";

type ModalMode = SainAmjadEntryType | null;

export default function SainAmjadPage() {
  const [entries, setEntries] = useState<SainAmjadEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [amount, setAmount] = useState<number | "">("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const supabase = createClient();

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sain_amjad_entries")
      .select("*")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setEntries([]);
    } else {
      setEntries((data ?? []) as SainAmjadEntry[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const addTotal = useMemo(
    () =>
      entries
        .filter((row) => row.entry_type === "add")
        .reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [entries]
  );

  const removeTotal = useMemo(
    () =>
      entries
        .filter((row) => row.entry_type === "remove")
        .reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [entries]
  );

  const openModal = (mode: SainAmjadEntryType) => {
    setModalMode(mode);
    setAmount("");
    setEntryDate(new Date().toISOString().split("T")[0]);
    setNotes("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalMode) return;
    const value = Number(amount);
    if (!value || value <= 0) {
      alert("Enter a valid amount.");
      return;
    }

    setFormLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("sain_amjad_entries").insert([
      {
        entry_type: modalMode,
        amount: value,
        entry_date: entryDate,
        notes: notes.trim() || null,
        created_by: userData.user?.id ?? null,
      },
    ]);
    setFormLoading(false);

    if (error) {
      alert(error.message);
      return;
    }
    setModalMode(null);
    fetchEntries();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this Sain Amjad entry?")) return;
    const { error } = await supabase.from("sain_amjad_entries").delete().eq("id", id);
    if (error) alert(error.message);
    else fetchEntries();
  };

  return (
    <AdminLayout>
      <Header title="Sain Amjad" searchPlaceholder="Quick search..." />

      <div className="page-shell">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-gray-900">Sain Amjad ledger</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Separate from hostel income, expenses, and profit. Only for tracking money with Sain
              Amjad.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={() => openModal("add")}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
            <button
              type="button"
              onClick={() => openModal("remove")}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 cursor-pointer"
            >
              <Minus className="h-4 w-4" />
              Remove
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex h-full flex-col rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Total add
            </span>
            <p className="mt-1 text-2xl font-bold text-emerald-900">
              {formatCurrency(addTotal, "PKR")}
            </p>
            <p className="mt-auto pt-1 text-xs text-emerald-700/80">
              Amount Sain Amjad gave to you
            </p>
          </div>
          <div className="flex h-full flex-col rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-700">
              Total remove
            </span>
            <p className="mt-1 text-2xl font-bold text-red-800">
              {formatCurrency(removeTotal, "PKR")}
            </p>
            <p className="mt-auto pt-1 text-xs text-red-700/80">Amount you gave to Sain Amjad</p>
          </div>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <p className="text-sm font-medium text-gray-500">No entries yet</p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-3 sm:px-6">Type</th>
                    <th className="px-4 py-3 sm:px-6 whitespace-nowrap">Date</th>
                    <th className="px-4 py-3 sm:px-6">Notes</th>
                    <th className="px-4 py-3 sm:px-6 text-right whitespace-nowrap">Amount</th>
                    <th className="px-4 py-3 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entries.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 sm:px-6">
                        {row.entry_type === "add" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            <ArrowDownLeft className="h-3 w-3" />
                            Add
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                            <ArrowUpRight className="h-3 w-3" />
                            Remove
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 sm:px-6 text-gray-600 whitespace-nowrap">
                        {formatDate(row.entry_date)}
                      </td>
                      <td className="px-4 py-3 sm:px-6 text-gray-800 break-words">
                        {row.notes?.trim() ? row.notes : <span className="text-gray-400">—</span>}
                      </td>
                      <td
                        className={`px-4 py-3 sm:px-6 text-right font-semibold whitespace-nowrap ${
                          row.entry_type === "add" ? "text-emerald-700" : "text-red-600"
                        }`}
                      >
                        {row.entry_type === "add" ? "+" : "−"}
                        {formatCurrency(Number(row.amount), "PKR")}
                      </td>
                      <td className="px-4 py-3 sm:px-6 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(row.id)}
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {modalMode && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setModalMode(null)} />
          <div className="modal-panel max-w-md">
            <button
              type="button"
              onClick={() => setModalMode(null)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
            >
              <X className="h-4.5 w-4.5" />
            </button>
            <h3 className="text-base font-bold text-gray-900 mb-1">
              {modalMode === "add" ? "Add — Sain Amjad gave you" : "Remove — you gave Sain Amjad"}
            </h3>
            <p className="text-xs text-gray-400 mb-6">
              This does not change hostel income, expenses, or profit.
            </p>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Amount
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    required
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-blue-400 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    required
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm cursor-pointer focus:border-blue-400 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 bg-white py-2 px-3 text-sm focus:border-blue-400 focus:outline-none resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={formLoading}
                className={`w-full rounded-lg py-3 text-sm font-semibold text-white disabled:opacity-60 cursor-pointer ${
                  modalMode === "add" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {formLoading ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : modalMode === "add" ? (
                  "Save add"
                ) : (
                  "Save remove"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
