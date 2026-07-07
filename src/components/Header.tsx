import React, { useState } from "react";
import { Cpu, Settings, FolderKanban, Plus, Check, X } from "lucide-react";

interface HeaderProps {
  nodeCount: number;
  onOpenSettings?: () => void;
  onToggleView?: (view: "graph" | "chat") => void;
  currentView: "graph" | "chat";
  subjects: { id: string; name: string }[];
  currentSubjectId: string;
  onSelectSubject: (id: string) => void;
  onAddSubject: (name: string) => void;
}

export default function Header({ 
  nodeCount, 
  onOpenSettings, 
  onToggleView, 
  currentView,
  subjects,
  currentSubjectId,
  onSelectSubject,
  onAddSubject
}: HeaderProps) {
  const [showNewSubjectForm, setShowNewSubjectForm] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSubjectName.trim()) {
      onAddSubject(newSubjectName.trim());
      setNewSubjectName("");
      setShowNewSubjectForm(false);
    }
  };

  return (
    <header className="bg-[#fcf9f8]/85 backdrop-blur-md border-b border-[#c0c8c9]/40 flex flex-col md:flex-row justify-between items-center w-full px-4 md:px-8 py-3 md:py-0 md:h-20 sticky top-0 z-40 shadow-sm gap-3">
      <div className="flex items-center justify-between w-full md:w-auto gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#f4ebd0] border border-[#d4af37]/40 flex items-center justify-center shadow-inner">
            <Cpu className="w-5 h-5 text-[#8c6239]" />
          </div>
          <div>
            <h1 className="font-serif text-lg md:text-xl font-bold text-[#4a3e3d] tracking-tight">
              Ciara's Second Brain
            </h1>
            <p className="text-[9px] text-[#8c6239] font-bold uppercase tracking-widest">
              Dynamic Semantic Graph Core
            </p>
          </div>
        </div>
      </div>

      {/* Dynamic Subjects / Workspaces selector */}
      <div className="flex items-center gap-2 max-w-full overflow-x-auto py-1">
        <div className="flex items-center gap-1.5 bg-[#f0eded] px-2 md:px-3 py-1.5 rounded-lg border border-[#c0c8c9]/40 shadow-inner">
          <FolderKanban className="w-3.5 h-3.5 text-[#3b6569]" />
          <span className="text-[10px] uppercase font-bold text-[#404849]/80 tracking-wider">Subject:</span>
          
          <select
            value={currentSubjectId}
            onChange={(e) => onSelectSubject(e.target.value)}
            className="bg-transparent text-xs font-bold text-[#3b6569] focus:outline-none pr-1 max-w-[150px] md:max-w-[200px] cursor-pointer"
          >
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id} className="bg-white text-[#1c1b1b]">
                {sub.name}
              </option>
            ))}
          </select>
        </div>

        {/* Create Subject toggle */}
        {!showNewSubjectForm ? (
          <button
            onClick={() => setShowNewSubjectForm(true)}
            className="p-1.5 rounded-lg bg-white border border-[#c0c8c9]/40 hover:bg-[#beeaef]/20 transition-all text-[#3b6569]"
            title="Create New Subject Vault"
          >
            <Plus className="w-4 h-4" />
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="flex items-center gap-1.5 bg-white border border-[#3b6569]/60 rounded-lg p-1 animate-fadeIn">
            <input
              type="text"
              placeholder="E.g., St Ives Craft"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              className="text-xs px-2 py-1 w-28 md:w-36 focus:outline-none font-medium"
              autoFocus
            />
            <button
              type="submit"
              className="p-1 bg-[#3b6569] text-white rounded hover:bg-[#3b6569]/90 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNewSubjectForm(false);
                setNewSubjectName("");
              }}
              className="p-1 text-[#404849]/60 hover:text-red-500 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </form>
        )}
      </div>

      {/* Segmented View Toggle (Mobile/Tablet helper) */}
      <div className="flex bg-[#f0eded] rounded-full p-1 border border-[#c0c8c9]/40 shrink-0">
        <button
          onClick={() => onToggleView?.("graph")}
          className={`px-4 md:px-5 py-1 rounded-full text-xs font-semibold transition-all ${
            currentView === "graph"
              ? "bg-white shadow-sm text-[#3b6569]"
              : "text-[#404849] hover:bg-[#e5e2e1]/50"
          }`}
        >
          Graph
        </button>
        <button
          onClick={() => onToggleView?.("chat")}
          className={`px-4 md:px-5 py-1 rounded-full text-xs font-semibold transition-all ${
            currentView === "chat"
              ? "bg-white shadow-sm text-[#3b6569]"
              : "text-[#404849] hover:bg-[#e5e2e1]/50"
          }`}
        >
          Chat
        </button>
      </div>

      <div className="flex items-center gap-2.5 md:gap-4 shrink-0">
        {/* Curatorial Status */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-white border border-[#c0c8c9]/40 rounded-full text-xs text-[#3b6569] font-semibold shadow-inner">
          <span className="w-2 h-2 rounded-full bg-[#8c6239] animate-pulse"></span>
          <span className="font-mono text-[10px] tracking-wider uppercase">GRAPH_READY</span>
        </div>

        {/* Node Count Indicator */}
        <div className="text-xs text-[#404849]">
          <span className="font-bold text-[#3b6569]">{nodeCount}</span> Nodes
        </div>

        <button 
          onClick={onOpenSettings}
          className="p-2 hover:bg-[#beeaef]/30 rounded-full transition-colors text-[#3b6569]"
          title="Curator Configuration"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
