"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Check, Search, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

export interface KanbanCustomer {
  id: string;
  name: string;
  status?: string;
  logoUrl?: string | null;
}

interface CustomerFieldProps {
  customers: KanbanCustomer[];
  selectedCustomerIds: string[];
  onToggleCustomer: (customerId: string) => void;
}

function WellChip({ well, compact = false }: { well: KanbanCustomer; compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        compact
          ? "px-2 py-1 text-[10px]"
          : "px-2.5 py-1.5 text-xs",
      )}
      style={{
        color: "#7DD3FC",
        backgroundColor: "rgba(14,165,233,0.12)",
        borderColor: "rgba(14,165,233,0.22)",
      }}
    >
      <Avatar
        name={well.name}
        size="xs"
        className={compact ? "!w-3.5 !h-3.5 text-[7px]" : "!w-4 !h-4 text-[7px]"}
      />
      <span className="truncate max-w-[110px]">{well.name}</span>
    </span>
  );
}

export function CustomerPills({ customers, compact = false }: { customers: KanbanCustomer[]; compact?: boolean }) {
  if (customers.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {customers.slice(0, compact ? 2 : 3).map((well) => (
        <WellChip key={well.id} well={well} compact={compact} />
      ))}
      {customers.length > (compact ? 2 : 3) && (
        <span className="inline-flex items-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-2 py-1 text-[10px] text-[#B0B0B0]">
          +{customers.length - (compact ? 2 : 3)}
        </span>
      )}
    </div>
  );
}

export function KanbanCustomerField({ customers, selectedCustomerIds, onToggleCustomer }: CustomerFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filteredWells = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((w) => w.name.toLowerCase().includes(term));
  }, [customers, query]);

  const selectedWells = customers.filter((w) => selectedCustomerIds.includes(w.id));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(18,18,18,0.96),rgba(13,13,13,0.96))] px-3 py-2 text-left transition-all hover:border-[rgba(14,165,233,0.25)]"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgba(14,165,233,0.12)] text-[#7DD3FC]">
            <Building2 size={14} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6A6A6A]">Oil Wells</div>
            {selectedWells.length > 0 ? (
              <div className="mt-1">
                <CustomerPills customers={selectedWells} compact />
              </div>
            ) : (
              <div className="mt-0.5 text-xs text-[#8A8A8A]">Link one or more wells</div>
            )}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            className="absolute left-0 right-0 top-full z-[120] mt-2 overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#131313] shadow-2xl"
          >
            <div className="border-b border-[rgba(255,255,255,0.06)] p-3">
              <div className="flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] px-3 py-2">
                <Search size={13} className="text-[#606060]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search wells..."
                  className="w-full bg-transparent text-xs text-[#F0F0F0] outline-none placeholder:text-[#5A5A5A]"
                />
                {query && (
                  <button type="button" onClick={() => setQuery("")} className="text-[#606060] hover:text-[#F0F0F0]">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto p-2">
              {filteredWells.length === 0 ? (
                <div className="px-3 py-5 text-center text-xs text-[#606060]">No matching wells</div>
              ) : (
                filteredWells.map((well) => {
                  const selected = selectedCustomerIds.includes(well.id);
                  return (
                    <button
                      key={well.id}
                      type="button"
                      onClick={() => onToggleCustomer(well.id)}
                      className={cn(
                        "mb-1 flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all",
                        selected
                          ? "border-[rgba(14,165,233,0.28)] bg-[rgba(14,165,233,0.12)]"
                          : "border-transparent bg-[rgba(255,255,255,0.02)] hover:border-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.04)]",
                      )}
                    >
                      <Avatar name={well.name} size="xs" className="!w-6 !h-6 text-[8px]" />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-[#F0F0F0]">{well.name}</span>
                      <span
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full border",
                          selected
                            ? "border-[rgba(125,211,252,0.5)] bg-[rgba(125,211,252,0.18)] text-[#7DD3FC]"
                            : "border-[rgba(255,255,255,0.1)] text-transparent",
                        )}
                      >
                        <Check size={11} />
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
