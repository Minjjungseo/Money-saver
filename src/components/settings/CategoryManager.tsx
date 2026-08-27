"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useData } from "@/lib/context/DataContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function CategoryManager() {
  const { data, addCategory, deleteCategory } = useData();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [newTopLevel, setNewTopLevel] = useState("");
  const [newSubFor, setNewSubFor] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState("");

  const topLevel = data.categories.filter((c) => !c.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
  const childrenOf = (id: string) => data.categories.filter((c) => c.parentId === id);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAddTopLevel() {
    if (!newTopLevel.trim()) return;
    addCategory({ name: newTopLevel.trim(), parentId: null, isIncome: false, sortOrder: data.categories.length });
    setNewTopLevel("");
  }

  function handleAddSub(parentId: string) {
    if (!newSubName.trim()) return;
    addCategory({ name: newSubName.trim(), parentId, isIncome: false, sortOrder: data.categories.length });
    setNewSubName("");
    setNewSubFor(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-2xl border border-border bg-surface">
        {topLevel.map((cat) => {
          const children = childrenOf(cat.id);
          const isOpen = expanded.has(cat.id);
          return (
            <div key={cat.id} className="border-b border-border last:border-b-0">
              <div className="flex items-center justify-between px-4 py-3">
                <button onClick={() => toggle(cat.id)} className="flex items-center gap-1.5 text-[14px] font-medium text-ink">
                  {children.length > 0 ? (
                    isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />
                  ) : (
                    <span className="w-[15px]" />
                  )}
                  {cat.name}
                </button>
                <div className="flex items-center gap-3">
                  <button onClick={() => setNewSubFor(newSubFor === cat.id ? null : cat.id)} className="text-[12px] font-medium text-accent">
                    + Sub
                  </button>
                  {!cat.isSystem && (
                    <button onClick={() => deleteCategory(cat.id)} className="text-ink-faint hover:text-negative">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              {isOpen && children.length > 0 && (
                <div className="flex flex-col gap-1.5 px-4 pb-3 pl-9">
                  {children.map((child) => (
                    <div key={child.id} className="flex items-center justify-between text-[13px] text-ink-muted">
                      <span>{child.name}</span>
                      {!child.isSystem && (
                        <button onClick={() => deleteCategory(child.id)} className="text-ink-faint hover:text-negative">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {newSubFor === cat.id && (
                <div className="flex items-center gap-2 px-4 pb-3 pl-9">
                  <Input
                    placeholder="Subcategory name"
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddSub(cat.id)}
                    className="h-9"
                  />
                  <Button size="sm" variant="accent" onClick={() => handleAddSub(cat.id)}>
                    Add
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="New category name"
          value={newTopLevel}
          onChange={(e) => setNewTopLevel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddTopLevel()}
        />
        <Button variant="secondary" onClick={handleAddTopLevel}>
          <Plus size={15} />
        </Button>
      </div>
    </div>
  );
}
