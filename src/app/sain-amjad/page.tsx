"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Header } from "@/components/layout/Header";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { SainAmjadEntry, SainAmjadEntryType, SainAmjadSpendLine } from "@/types/database";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  ChevronDown,
  ChevronRight,
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
  const [spendLines, setSpendLines] = useState<SainAmjadSpendLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | "">("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [spendDescription, setSpendDescription] = useState("");
  const [spendAmount, setSpendAmount] = useState<number | "">("");
  const [spendDate, setSpendDate] = useState(new Date().toISOString().split("T")[0]);
  const [spendSaving, setSpendSaving] = useState(false);
  const supabase = createClient();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: entryData, error: entryError }, { data: spendData, error: spendError }] =
      await Promise.all([
        supabase
          .from("sain_amjad_entries")
          .select("*")
          .order("entry_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("sain_amjad_spend_lines")
          .select("*")
          .order("spend_date", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

    if (entryError) {
      alert(entryError.message);
      setEntries([]);
    } else {
      setEntries((entryData ?? []) as SainAmjadEntry[]);
    }

    if (spendError) {
      if (!/does not exist|schema cache|could not find/i.test(spendError.message)) {
        alert(spendError.message);
      }
      setSpendLines([]);
    } else {
      setSpendLines((spendData ?? []) as SainAmjadSpendLine[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const spendByEntry = useMemo(() => {
    const map = new Map<string, SainAmjadSpendLine[]>();
    for (const line of spendLines) {
      const list = map.get(line.entry_id) ?? [];
      list.push(line);
      map.set(line.entry_id, list);
    }
    return map;
  }, [spendLines]);

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

  const spentFromAdds = useMemo(
    () => spendLines.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [spendLines]
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
    const { data, error } = await supabase
      .from("sain_amjad_entries")
      .insert([
        {
          entry_type: modalMode,
          amount: value,
          entry_date: entryDate,
          notes: notes.trim() || null,
          created_by: userData.user?.id ?? null,
        },
      ])
      .select("id")
      .single();
    setFormLoading(false);

    if (error) {
      alert(error.message);
      return;
    }
    setModalMode(null);
    await fetchAll();
    if (modalMode === "add" && data?.id) {
      setOpenEntryId(data.id);
      setSpendDescription("");
      setSpendAmount("");
      setSpendDate(new Date().toISOString().split("T")[0]);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this Sain Amjad entry and its spend lines?")) return;
    const { error } = await supabase.from("sain_amjad_entries").delete().eq("id", id);
    if (error) alert(error.message);
    else {
      if (openEntryId === id) setOpenEntryId(null);
      fetchAll();
    }
  };

  const toggleEntry = (id: string) => {
    setOpenEntryId((current) => (current === id ? null : id));
    setSpendDescription("");
    setSpendAmount("");
    setSpendDate(new Date().toISOString().split("T")[0]);
  };

  const handleAddSpend = async (e: React.FormEvent, entry: SainAmjadEntry) => {
    e.preventDefault();
    e.stopPropagation();
    const value = Number(spendAmount);
    if (!spendDescription.trim()) {
      alert("Enter where this money was spent.");
      return;
    }
    if (!value || value <= 0) {
      alert("Enter a valid spend amount.");
      return;
    }

    const alreadySpent = (spendByEntry.get(entry.id) ?? []).reduce(
      (sum, line) => sum + Number(line.amount || 0),
      0
    );
    const remaining = Number(entry.amount) - alreadySpent;
    if (value > remaining + 0.009) {
      alert(`Only ${formatCurrency(remaining, "PKR")} is left on this add entry.`);
      return;
    }

    setSpendSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("sain_amjad_spend_lines").insert([
      {
        entry_id: entry.id,
        description: spendDescription.trim(),
        amount: value,
        spend_date: spendDate,
        created_by: userData.user?.id ?? null,
      },
    ]);
    setSpendSaving(false);
    if (error) {
      alert(error.message);
      return;
    }
    setSpendDescription("");
    setSpendAmount("");
    setSpendDate(new Date().toISOString().split("T")[0]);
    fetchAll();
  };

  const handleDeleteSpend = async (id: string) => {
    if (!confirm("Delete this spend line?")) return;
    const { error } = await supabase.from("sain_amjad_spend_lines").delete().eq("id", id);
    if (error) alert(error.message);
    else fetchAll();
  };

  return (
    <AdminLayout>
      <Header title="Sain Amjad" searchPlaceholder="Quick search..." />

      <div className="page-shell">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-gray-900">Sain Amjad ledger</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Add money from Sain Amjad, then click that line to record where you spent it.
              Remove is money you gave him. This is not part of hostel profit.
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
              Spent {formatCurrency(spentFromAdds, "PKR")} from add entries
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
          <div className="space-y-3">
            {entries.map((row) => {
              const lines = spendByEntry.get(row.id) ?? [];
              const spent = lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
              const remaining = Number(row.amount) - spent;
              const isOpen = openEntryId === row.id;
              const isAdd = row.entry_type === "add";

              return (
                <div
                  key={row.id}
                  className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
                >
                  <div
                    role={isAdd ? "button" : undefined}
                    tabIndex={isAdd ? 0 : undefined}
                    onClick={() => {
                      if (isAdd) toggleEntry(row.id);
                    }}
                    onKeyDown={(event) => {
                      if (isAdd && (event.key === "Enter" || event.key === " ")) {
                        event.preventDefault();
                        toggleEntry(row.id);
                      }
                    }}
                    className={`flex items-center gap-3 px-4 py-3 sm:px-5 ${
                      isAdd ? "cursor-pointer hover:bg-gray-50/80" : ""
                    }`}
                  >
                    {isAdd ? (
                      isOpen ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                      )
                    ) : (
                      <span className="w-4" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {isAdd ? (
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
                        <span className="text-xs text-gray-500">{formatDate(row.entry_date)}</span>
                      </div>
                      <p className="mt-1 text-sm text-gray-800">
                        {row.notes?.trim() ? row.notes : isAdd ? "Click to add spend lines" : "—"}
                      </p>
                      {isAdd && (
                        <p className="mt-1 text-xs text-gray-500">
                          Remaining {formatCurrency(remaining, "PKR")} · {lines.length} spend line
                          {lines.length === 1 ? "" : "s"}
                        </p>
                      )}
                    </div>
                    <p
                      className={`shrink-0 text-sm font-semibold ${
                        isAdd ? "text-emerald-700" : "text-red-600"
                      }`}
                    >
                      {isAdd ? "+" : "−"}
                      {formatCurrency(Number(row.amount), "PKR")}
                    </p>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDelete(row.id);
                      }}
                      className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {isAdd && isOpen && (
                    <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-4 sm:px-5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                        Where this money was spent
                      </p>

                      {lines.length === 0 ? (
                        <p className="text-sm text-gray-400 mb-4">No spend lines yet</p>
                      ) : (
                        <div className="mb-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
                          <table className="w-full text-left text-sm">
                            <thead>
                              <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-400">
                                <th className="px-3 py-2">Spent on</th>
                                <th className="px-3 py-2 whitespace-nowrap">Date</th>
                                <th className="px-3 py-2 text-right">Amount</th>
                                <th className="px-3 py-2 w-10" />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {lines.map((line) => (
                                <tr key={line.id}>
                                  <td className="px-3 py-2 text-gray-800">{line.description}</td>
                                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                                    {formatDate(line.spend_date)}
                                  </td>
                                  <td className="px-3 py-2 text-right font-semibold text-red-600">
                                    −{formatCurrency(Number(line.amount), "PKR")}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSpend(line.id)}
                                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <form
                        onSubmit={(event) => handleAddSpend(event, row)}
                        className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_8rem_8rem_auto]"
                      >
                        <input
                          type="text"
                          value={spendDescription}
                          onChange={(e) => setSpendDescription(e.target.value)}
                          placeholder="Where spent (e.g. shop, petrol)"
                          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                        />
                        <input
                          type="date"
                          value={spendDate}
                          onChange={(e) => setSpendDate(e.target.value)}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm cursor-pointer focus:border-blue-400 focus:outline-none"
                        />
                        <input
                          type="number"
                          min={1}
                          value={spendAmount}
                          onChange={(e) =>
                            setSpendAmount(e.target.value === "" ? "" : Number(e.target.value))
                          }
                          placeholder="Amount"
                          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={spendSaving || remaining <= 0}
                          className="inline-flex items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {spendSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save line"}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              );
            })}
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
              {modalMode === "add"
                ? "After saving, click the new line to enter where you spent this money."
                : "This does not change hostel income, expenses, or profit."}
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
                  modalMode === "add"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-red-600 hover:bg-red-700"
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
