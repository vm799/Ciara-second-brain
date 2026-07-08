import React, { useState, useEffect, useRef } from "react";
import Header from "./components/Header";
// @ts-ignore
import bgImage from "./assets/images/colorful_ballerina_silhouette_1783490261389.jpg";
import { BrainNode, NodeLink, ChatMessage } from "./types";
import { 
  Upload, Play, Pause, Plus, Trash2, Link2, Search, Send, 
  HelpCircle, X, Sparkles, Cpu, FileText, Image as ImageIcon, 
  Music, MessageSquare, Check, ArrowRight, Eye, RefreshCw, Settings,
  Mic, Radio
} from "lucide-react";

export default function App() {
  const [nodes, setNodes] = useState<BrainNode[]>([]);
  const [links, setLinks] = useState<NodeLink[]>([]);
  const [activeNode, setActiveNode] = useState<BrainNode | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "system",
      text: "Welcome to **Ciara's Second Brain**. This is her dynamic, multi-subject knowledge and semantic mapping network. She can organize notes, photographs, inscriptions, and live voice logs into specific vaults like **Isabel Moore Weaving Vault**, **British Museum Exhibits**, or custom workspaces. Everything here is linked semantically without rigid AI dictates, allowing you to build your own distinct connections.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const [currentView, setCurrentView] = useState<"graph" | "chat">("graph");
  const [mobileTab, setMobileTab] = useState<"intake" | "graph" | "chat" | "index">("graph");

  // Drag and drop states
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<"image" | "audio" | "text">("text");
  const [textInputContent, setTextInputContent] = useState("");
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // Processed outcome modal state
  const [processedOutcome, setProcessedOutcome] = useState<{
    raw_transcription_or_ocr: string;
    extracted_entities: string[];
    suggested_node_links: { target_node_id: string; reason_for_connection: string }[];
    suggested_title: string;
    suggested_color: string;
  } | null>(null);

  // App settings/info modal
  const [showHelp, setShowHelp] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showLanding, setShowLanding] = useState(true);

  // Sidebar / panel tabs or states
  const [newTagName, setNewTagName] = useState("");
  const [manualLinkTarget, setManualLinkTarget] = useState("");
  const [manualLinkReason, setManualLinkReason] = useState("");
  
  // Voice recorder state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        const voiceFile = new File([audioBlob], `voice-note-${Date.now()}.wav`, { type: "audio/wav" });
        setSelectedFile(voiceFile);
        setUploadType("audio");
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (e) {
      console.error("Error accessing microphone:", e);
      alert("Microphone access is constrained. Please ensure you allow microphone permission or open the app in a new tab.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  // Audio playback emulation state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioPlaybackProgress, setAudioPlaybackProgress] = useState(35);
  const audioIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Graph custom layout positioning
  const nodePositions: Record<string, { x: number; y: number }> = {
    "ISABELLE-MAIN": { x: 50, y: 50 },
    "TAPESTRY-04": { x: 72, y: 35 },
    "AUD-WOOL": { x: 28, y: 25 },
    "WORKSHOP-LOG": { x: 55, y: 75 },
    "INSCRIPTION-01": { x: 50, y: 45 },
    "MUSEUM-PHOTO": { x: 75, y: 65 },
    "MUSEUM-VOICE": { x: 25, y: 65 },
    "Alpha-7": { x: 45, y: 40 },
    "AUD-092": { x: 65, y: 70 }
  };

  // Keep track of dynamically created nodes to give them positions
  const [dynamicPositions, setDynamicPositions] = useState<Record<string, { x: number; y: number }>>({});

  // Dynamic Subjects states
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [currentSubjectId, setCurrentSubjectId] = useState<string>("isabel-moore");

  // Node Editing Modal/Drawer States
  const [isEditingNode, setIsEditingNode] = useState(false);
  const [editNodeForm, setEditNodeForm] = useState({
    title: "",
    content: "",
    color: "",
    tags: [] as string[],
    linkDescription: ""
  });

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch subjects from API
  const fetchSubjects = async () => {
    try {
      const res = await fetch("/api/subjects");
      if (res.ok) {
        const data = await res.json();
        setSubjects(data);
      }
    } catch (e) {
      console.error("Error fetching subjects:", e);
    }
  };

  // Fetch nodes from API for specific subject
  const fetchGraphData = async (subjectId = currentSubjectId) => {
    try {
      const res = await fetch(`/api/nodes?subjectId=${subjectId}`);
      if (res.ok) {
        const data = await res.json();
        setNodes(data.nodes);
        setLinks(data.links);
        
        // If activeNode is selected, refresh its details
        if (activeNode) {
          const updated = data.nodes.find((n: BrainNode) => n.id === activeNode.id);
          if (updated) {
            setActiveNode(updated);
          } else {
            setActiveNode(null);
          }
        }
      }
    } catch (e) {
      console.error("Error fetching nodes:", e);
    }
  };

  // Create new Subject Vault on backend
  const handleAddSubject = async (name: string) => {
    try {
      const res = await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        const data = await res.json();
        setSubjects(data.subjects);
        setCurrentSubjectId(data.subject.id);
        setActiveNode(null);
        
        // Push welcome system message for the new subject
        setChatMessages(prev => [
          ...prev,
          {
            id: `new-sub-${Date.now()}`,
            sender: "system",
            text: `Created a brand new subject vault: **${data.subject.name}**. Drag and drop files, record voice notes, or paste manual texts here to populate Ciara's knowledge graph.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    } catch (e) {
      console.error("Error creating subject:", e);
    }
  };

  // Load subject workspace dynamically
  useEffect(() => {
    fetchGraphData(currentSubjectId);
  }, [currentSubjectId]);

  useEffect(() => {
    fetchSubjects();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Generate randomized but structured positions for new nodes
  const getNodePosition = (id: string, index: number) => {
    if (nodePositions[id]) return nodePositions[id];
    if (dynamicPositions[id]) return dynamicPositions[id];

    // Compute a new placement circular layout
    const angle = (index * 73) % 360;
    const distance = 25 + (index * 4) % 15;
    const x = 50 + distance * Math.cos((angle * Math.PI) / 180);
    const y = 50 + distance * Math.sin((angle * Math.PI) / 180);
    
    // Save to dynamic states
    setDynamicPositions(prev => ({
      ...prev,
      [id]: { x, y }
    }));

    return { x, y };
  };

  // Change active node color
  const handleUpdateColor = async (color: string) => {
    if (!activeNode) return;
    try {
      const res = await fetch(`/api/nodes/${activeNode.id}/color?subjectId=${currentSubjectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color })
      });
      if (res.ok) {
        await fetchGraphData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Add tag to active node
  const handleAddTag = async () => {
    if (!activeNode || !newTagName.trim()) return;
    const sanitizedTag = newTagName.startsWith("#") ? newTagName.trim() : `#${newTagName.trim()}`;
    if (activeNode.tags.includes(sanitizedTag)) {
      setNewTagName("");
      return;
    }
    const updatedTags = [...activeNode.tags, sanitizedTag];
    try {
      const res = await fetch(`/api/nodes/${activeNode.id}/tags?subjectId=${currentSubjectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: updatedTags })
      });
      if (res.ok) {
        setNewTagName("");
        await fetchGraphData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Remove tag
  const handleRemoveTag = async (tagToRemove: string) => {
    if (!activeNode) return;
    const updatedTags = activeNode.tags.filter(t => t !== tagToRemove);
    try {
      const res = await fetch(`/api/nodes/${activeNode.id}/tags?subjectId=${currentSubjectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: updatedTags })
      });
      if (res.ok) {
        await fetchGraphData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Update link description
  const handleUpdateDescription = async (desc: string) => {
    if (!activeNode) return;
    try {
      await fetch(`/api/nodes/${activeNode.id}/description?subjectId=${currentSubjectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkDescription: desc })
      });
      // Do not block UI, just save in background
      setNodes(prev => prev.map(n => n.id === activeNode.id ? { ...n, linkDescription: desc } : n));
    } catch (e) {
      console.error(e);
    }
  };

  // Create manual relation link
  const handleCreateManualLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeNode || !manualLinkTarget || !manualLinkReason.trim()) return;
    try {
      const res = await fetch(`/api/nodes/${activeNode.id}/links?subjectId=${currentSubjectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: manualLinkTarget,
          reason: manualLinkReason
        })
      });
      if (res.ok) {
        setManualLinkTarget("");
        setManualLinkReason("");
        await fetchGraphData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Delete manual connection link
  const handleDeleteLink = async (targetId: string) => {
    if (!activeNode) return;
    if (!confirm("Are you sure you want to remove this connection?")) return;
    try {
      const res = await fetch(`/api/nodes/${activeNode.id}/links?subjectId=${currentSubjectId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId })
      });
      if (res.ok) {
        await fetchGraphData();
      }
    } catch (e) {
      console.error("Error deleting link:", e);
    }
  };

  // Delete Node
  const handleDeleteNode = async (id: string) => {
    if (!confirm(`Are you sure you want to delete ${id}?`)) return;
    try {
      const res = await fetch(`/api/nodes/${id}?subjectId=${currentSubjectId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setActiveNode(null);
        await fetchGraphData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Edit Node Context
  const handleOpenEditNode = () => {
    if (!activeNode) return;
    setEditNodeForm({
      title: activeNode.title,
      content: activeNode.content,
      color: activeNode.color,
      tags: [...activeNode.tags],
      linkDescription: activeNode.linkDescription || ""
    });
    setIsEditingNode(true);
  };

  const handleSaveNodeEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeNode) return;
    try {
      const res = await fetch(`/api/nodes/${activeNode.id}/edit?subjectId=${currentSubjectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editNodeForm)
      });
      if (res.ok) {
        setIsEditingNode(false);
        await fetchGraphData();
      }
    } catch (e) {
      console.error("Error saving node edit:", e);
    }
  };

  // Submit search query or chat prompt
  const handleSendChat = async (e?: React.FormEvent, customMsg?: string) => {
    if (e) e.preventDefault();
    const query = customMsg || chatInput;
    if (!query.trim()) return;

    // Append user message
    const userMsgId = `user-${Date.now()}`;
    const newMsg: ChatMessage = {
      id: userMsgId,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, newMsg]);
    if (!customMsg) setChatInput("");
    setLoadingChat(true);

    try {
      const res = await fetch(`/api/chat?subjectId=${currentSubjectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          chatHistory: chatMessages
        })
      });

      if (res.ok) {
        const data = await res.json();
        
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: "system",
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          citations: data.citations,
          highlightedNodeId: data.highlightedNodeId
        };
        
        setChatMessages(prev => [...prev, aiMsg]);

        // If highlighedNodeId is returned, activate and glow it!
        if (data.highlightedNodeId) {
          const targetNode = nodes.find(n => n.id === data.highlightedNodeId);
          if (targetNode) {
            setActiveNode(targetNode);
            setCurrentView("graph");
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingChat(false);
    }
  };

  // Handle Drag & Drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileSelected(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    // Auto-detect type by extension/mimetype
    if (file.type.startsWith("image/")) {
      setUploadType("image");
    } else if (file.type.startsWith("audio/") || file.name.endsWith(".wav") || file.name.endsWith(".mp3")) {
      setUploadType("audio");
    } else {
      setUploadType("text");
    }
  };

  // Convert File to Base64 String
  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64Str = reader.result as string;
        // Split out the header data URI prefix
        const cleanBase64 = base64Str.split(",")[1];
        resolve(cleanBase64);
      };
      reader.onerror = error => reject(error);
    });
  };

  // Execute Media processing via pipeline
  const handleProcessMedia = async () => {
    if (!selectedFile && uploadType !== "text") return;
    setIsProcessingFile(true);

    try {
      let payload: any = {
        type: uploadType,
        fileName: selectedFile ? selectedFile.name : `Note-${Date.now()}.txt`
      };

      if (uploadType === "image" && selectedFile) {
        payload.base64Data = await convertToBase64(selectedFile);
        payload.mimeType = selectedFile.type;
      } else if (uploadType === "audio" && selectedFile) {
        payload.base64Data = await convertToBase64(selectedFile);
        payload.mimeType = selectedFile.type;
      } else {
        // Text Note
        payload.content = textInputContent;
      }

      const res = await fetch(`/api/process?subjectId=${currentSubjectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        setProcessedOutcome(result);
      }
    } catch (e) {
      console.error(e);
      alert("Error analyzing file. Ensure API variables are fully setup.");
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Integrate analyzed metadata into actual node store
  const handleIntegrateProcessedOutcome = async () => {
    if (!processedOutcome) return;

    try {
      // Connect to first suggested node link if present
      const firstLink = processedOutcome.suggested_node_links?.[0];
      
      const payload = {
        title: processedOutcome.suggested_title || (selectedFile ? selectedFile.name : "Analyzed Node"),
        content: processedOutcome.raw_transcription_or_ocr,
        type: uploadType,
        color: processedOutcome.suggested_color || "#3b6569",
        tags: processedOutcome.extracted_entities.map(tag => tag.startsWith("#") ? tag : `#${tag.toLowerCase().replace(/\s+/g, "-")}`),
        linkDescription: firstLink ? firstLink.reason_for_connection : "",
        targetNodeId: firstLink ? firstLink.target_node_id : undefined,
        reasonForConnection: firstLink ? firstLink.reason_for_connection : undefined
      };

      const res = await fetch(`/api/nodes?subjectId=${currentSubjectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setNodes(data.nodes);
        setLinks(data.links);
        
        // Auto select the newly integrated node
        if (data.node) {
          setActiveNode(data.node);
        }

        // Clean up
        setSelectedFile(null);
        setTextInputContent("");
        setProcessedOutcome(null);
        setCurrentView("graph");

        // Add automated success logs to chat stream
        setChatMessages(prev => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            sender: "system",
            text: `Successfully mapped **${payload.title}** to the knowledge graph with tags: ${payload.tags.join(", ")}. Overlap verified with ${firstLink ? `**${firstLink.target_node_id}**` : "the neural core"}.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Toggle custom audio player progress emulation
  const handleToggleAudioPlay = () => {
    if (isPlayingAudio) {
      setIsPlayingAudio(false);
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    } else {
      setIsPlayingAudio(true);
      audioIntervalRef.current = setInterval(() => {
        setAudioPlaybackProgress(prev => {
          if (prev >= 100) return 0;
          return prev + 1;
        });
      }, 300);
    }
  };

  useEffect(() => {
    return () => {
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    };
  }, [isPlayingAudio]);

  return (
    <div 
      className="min-h-screen flex flex-col text-[#1c1b1b] overflow-x-hidden selection:bg-[#beeaef] selection:text-[#456e73] pb-20 lg:pb-0"
      style={{ 
        backgroundImage: `linear-gradient(to bottom, rgba(252, 249, 248, 0.5), rgba(252, 249, 248, 0.4)), url(${bgImage})`, 
        backgroundSize: 'cover', 
        backgroundAttachment: 'fixed',
        backgroundPosition: 'center' 
      }}
    >
      <Header 
        nodeCount={nodes.length} 
        onOpenSettings={() => setShowConfig(true)} 
        onToggleView={(v) => {
          setCurrentView(v);
          setMobileTab(v as any);
        }}
        currentView={currentView}
        subjects={subjects}
        currentSubjectId={currentSubjectId}
        onSelectSubject={(id) => {
          setCurrentSubjectId(id);
          setActiveNode(null);
        }}
        onAddSubject={handleAddSubject}
        onShowLanding={() => setShowLanding(true)}
      />

      {showLanding ? (
        <div 
          className="flex-1 relative overflow-hidden flex flex-col justify-between py-8 px-4 md:px-12 lg:px-24"
          style={{ 
            backgroundImage: `linear-gradient(to bottom, rgba(250, 247, 245, 0.45), rgba(250, 247, 245, 0.4)), url(${bgImage})`, 
            backgroundSize: 'cover', 
            backgroundPosition: 'center' 
          }}
        >
          {/* Abstract Flowing Pastel Background Blobs */}
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-[#beeaef]/60 blur-3xl animate-pulse duration-[8s]" />
            <div className="absolute -bottom-45 -right-45 w-[500px] h-[500px] rounded-full bg-[#ffd8ea]/55 blur-3xl animate-pulse duration-[10s]" />
            <div className="absolute top-1/2 left-1/3 w-[350px] h-[350px] rounded-full bg-[#beeaef]/50 blur-3xl animate-pulse duration-[6s]" />
            <div className="absolute bottom-1/4 left-1/10 w-[250px] h-[250px] rounded-full bg-[#714f94]/25 blur-3xl animate-pulse duration-[9s]" />
          </div>

          <div className="relative z-10 max-w-5xl mx-auto flex-1 flex flex-col justify-center my-auto">
            {/* Top Badge */}
            <div className="inline-flex items-center gap-2 bg-[#beeaef]/60 border border-[#3b6569]/40 px-3 py-1 rounded-full text-[10px] text-[#3b6569] font-extrabold uppercase tracking-widest mb-6 self-start animate-fadeIn">
              <Sparkles className="w-3.5 h-3.5" /> Dynamic Semantic Archival Vault
            </div>

            {/* Giant Bold App Title & Heading */}
            <div className="space-y-4 max-w-3xl mb-8">
              <h1 className="font-serif text-5xl md:text-7xl font-black text-[#3a2f2e] tracking-tight leading-none">
                Ciara's <span className="text-[#3b6569] bg-[#beeaef]/50 px-4 py-1 rounded-2xl">Second Brain</span>
              </h1>
              <p className="font-sans text-lg md:text-xl font-bold text-[#3b6569] leading-relaxed">
                An elegant multi-subject knowledge and relational semantic core. Map notes, audio logs, and photographic exhibits into a connected tapestry.
              </p>
            </div>

            {/* Grid Explaining What, Does, How */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 w-full">
              {/* Card 1: What is it? */}
              <div className="bg-white/85 backdrop-blur-md p-6 rounded-2xl border border-[#c0c8c9]/50 shadow-sm hover:shadow-md hover:border-[#3b6569]/40 transition-all space-y-3 group">
                <div className="w-10 h-10 rounded-xl bg-[#beeaef] text-[#3b6569] flex items-center justify-center font-black text-lg shadow-sm">
                  01
                </div>
                <h3 className="font-sans text-base font-black text-[#3a2f2e] uppercase tracking-wide">
                  What is it?
                </h3>
                <p className="text-xs text-[#404849]/95 leading-relaxed font-sans font-medium">
                  An elegant **personal digital repository** designed to liberate information from boring static folders. It dynamically generates an interactive node-network representing your knowledge ecosystem.
                </p>
              </div>

              {/* Card 2: What does it do? */}
              <div className="bg-white/85 backdrop-blur-md p-6 rounded-2xl border border-[#c0c8c9]/50 shadow-sm hover:shadow-md hover:border-[#3b6569]/40 transition-all space-y-3 group">
                <div className="w-10 h-10 rounded-xl bg-[#ffd8ea] text-[#714f94] flex items-center justify-center font-black text-lg shadow-sm">
                  02
                </div>
                <h3 className="font-sans text-base font-black text-[#3a2f2e] uppercase tracking-wide">
                  What does it do?
                </h3>
                <p className="text-xs text-[#404849]/95 leading-relaxed font-sans font-medium">
                  It takes raw data—images, live voice recordings, or scribbed thoughts—transcribes them using Gemini, extracts entities, and **automatically suggests cross-linked connections** to other thoughts in your vault.
                </p>
              </div>

              {/* Card 3: How to use it? */}
              <div className="bg-white/85 backdrop-blur-md p-6 rounded-2xl border border-[#c0c8c9]/50 shadow-sm hover:shadow-md hover:border-[#3b6569]/40 transition-all space-y-3 group">
                <div className="w-10 h-10 rounded-xl bg-[#beeaef] text-[#3b6569] flex items-center justify-center font-black text-lg shadow-sm">
                  03
                </div>
                <h3 className="font-sans text-base font-black text-[#3a2f2e] uppercase tracking-wide">
                  How to use?
                </h3>
                <p className="text-xs text-[#404849]/95 leading-relaxed font-sans font-medium">
                  1. **Intake**: Drop a file or record a voice memo.<br />
                  2. **Link**: Click any node and map a relation to another.<br />
                  3. **Ask**: Query the AI in natural language to locate files or answer complex contextual questions instantly.
                </p>
              </div>
            </div>

            {/* Launch CTA */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button
                onClick={() => setShowLanding(false)}
                className="w-full sm:w-auto px-8 py-4 bg-[#3b6569] hover:bg-[#3b6569]/90 text-white rounded-full font-sans font-black uppercase text-sm tracking-wider shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 group hover:scale-[1.02]"
              >
                Launch Brain Core <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              
              <div className="text-xs text-[#404849]/80 font-mono">
                Currently tracking <span className="font-bold text-[#3b6569]">{nodes.length} nodes</span> across <span className="font-bold text-[#3b6569]">{subjects.length || 3} vaults</span>
              </div>
            </div>
          </div>

          {/* Footer of Landing Page */}
          <div className="relative z-10 border-t border-[#c0c8c9]/35 pt-6 mt-8 flex flex-col sm:flex-row justify-between items-center text-[10px] text-[#404849]/60 font-mono tracking-widest uppercase">
            <span>OFFLINE-FIRST PERSISTED SEED</span>
            <span>SECURE GEMINI SEMANTIC EXTRACTION COGNITION</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row relative">
        
        {/* Left Side: Capture Intake & Vault Index List */}
        <section className={`w-full lg:w-[32%] bg-[#f6f3f2]/35 backdrop-blur-md border-r border-[#c0c8c9]/40 p-4 md:p-6 lg:flex flex-col gap-6 ${mobileTab === "intake" || mobileTab === "index" ? "flex" : "hidden"}`}>
          
          {/* Capture Intake Box */}
          <div className={`bg-white/75 backdrop-blur-sm p-5 rounded-lg border border-[#c0c8c9]/40 shadow-sm relative overflow-hidden ${mobileTab === "intake" ? "block" : "hidden lg:block"}`}>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#c0c8c9]/30">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#3b6569]" />
                <h3 className="font-sans text-xs font-black text-[#3a2f2e] uppercase tracking-widest">
                  Capture Intake
                </h3>
              </div>
              <button 
                onClick={() => setShowHelp(true)}
                className="text-xs text-[#3b6569] hover:underline flex items-center gap-1"
              >
                <HelpCircle className="w-3.5 h-3.5" /> Pipeline Guidelines
              </button>
            </div>

            {/* Drag & Drop Area */}
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border border-dashed rounded-lg p-5 text-center transition-all cursor-pointer relative ${
                isDraggingOver 
                  ? "border-[#3b6569] bg-[#beeaef]/20 scale-95" 
                  : "border-[#c0c8c9] hover:border-[#3b6569]/60 bg-[#fcf9f8]/60"
              }`}
            >
              <input 
                type="file" 
                id="file-upload" 
                className="hidden" 
                onChange={handleFileChange}
                accept="image/*,audio/*,.txt,.pdf,.md"
              />
              <label htmlFor="file-upload" className="cursor-pointer block">
                <Upload className="w-10 h-10 text-[#404849]/50 mx-auto mb-3" />
                <p className="font-serif text-sm text-[#1c1b1b] font-semibold">
                  Drag &amp; Drop Multi-Media Here
                </p>
                <p className="text-[11px] text-[#404849]/70 mt-1">
                  Supports screenshots (OCR), voice memos (verbatim), or text lists
                </p>
                <span className="inline-block mt-3 px-3 py-1 bg-[#beeaef] text-[#456e73] font-mono text-[10px] uppercase font-bold rounded-full hover:bg-[#3b6569] hover:text-white transition-colors shadow-sm">
                  Select File
                </span>
              </label>
            </div>

            {/* Intake details & Selection mode */}
            {selectedFile && (
              <div className="mt-4 p-3 bg-[#f0eded] rounded border border-[#c0c8c9]/40 flex items-center justify-between">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  {uploadType === "image" ? (
                    <ImageIcon className="w-4 h-4 text-[#3b6569] shrink-0" />
                  ) : uploadType === "audio" ? (
                    <Music className="w-4 h-4 text-[#714f94] shrink-0" />
                  ) : (
                    <FileText className="w-4 h-4 text-[#854c6c] shrink-0" />
                  )}
                  <div className="text-xs truncate">
                    <p className="font-bold text-[#1c1b1b] truncate">{selectedFile.name}</p>
                    <p className="text-[10px] text-[#404849]/70 uppercase font-mono">
                      {(selectedFile.size / 1024).toFixed(1)} KB | {uploadType}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedFile(null)}
                  className="p-1 hover:bg-white rounded text-[#404849]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Record Live Voice Note */}
            <div className="mt-4 p-3 bg-[#f6f3f2] rounded border border-[#c0c8c9]/40 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#404849]/80 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Mic className="w-3.5 h-3.5 text-[#714f94]" /> Record Live Voice Note
                </span>
                {isRecording && (
                  <span className="text-[10px] text-red-600 font-mono font-bold animate-pulse flex items-center gap-1">
                    <Radio className="w-3 h-3 text-red-600 animate-pulse shrink-0" />
                    REC {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, "0")}
                  </span>
                )}
              </div>
              
              <div className="flex gap-2">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="flex-1 py-2 px-3 bg-[#714f94] text-white hover:bg-[#714f94]/90 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm"
                  >
                    <Mic className="w-4 h-4" /> Start Recording
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="flex-1 py-2 px-3 bg-red-600 text-white hover:bg-red-700 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm animate-pulse"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-white mr-1" /> Stop &amp; Save Note
                  </button>
                )}
              </div>
            </div>

            {/* Quick manual text payload uploader */}
            {!selectedFile && (
              <div className="mt-4">
                <label className="block text-[10px] text-[#404849]/80 font-bold uppercase tracking-wider mb-1.5">
                  Or Paste Text List / Thought Note
                </label>
                <textarea
                  value={textInputContent}
                  onChange={(e) => {
                    setTextInputContent(e.target.value);
                    setUploadType("text");
                  }}
                  placeholder="Paste textile fibers, natural seaweed-dye recipes, wool warp tensions, and Cornish coastal erosion logs..."
                  rows={3}
                  className="w-full text-xs p-3 bg-[#fcf9f8] border border-[#c0c8c9]/60 rounded focus:ring-1 focus:ring-[#3b6569] focus:outline-none resize-none placeholder:text-[#404849]/50"
                />
              </div>
            )}

            {/* Pipeline dispatch button */}
            <button
              onClick={handleProcessMedia}
              disabled={isProcessingFile || (!selectedFile && !textInputContent.trim())}
              className={`w-full mt-4 py-3 rounded text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                isProcessingFile || (!selectedFile && !textInputContent.trim())
                  ? "bg-[#eae7e7] text-[#404849]/40 cursor-not-allowed"
                  : "bg-[#3b6569] text-white hover:bg-[#3b6569]/90 active:scale-95 shadow"
              }`}
            >
              {isProcessingFile ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Synthesizing Payload...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Dispatch Pipeline
                </>
              )}
            </button>
          </div>

          {/* Knowledge Vault Index */}
          <div className={`flex-1 bg-white/75 backdrop-blur-sm p-5 rounded-lg border border-[#c0c8c9]/40 shadow-sm flex flex-col overflow-hidden ${mobileTab === "index" ? "flex" : "hidden lg:flex"}`}>
            <h4 className="font-sans text-xs font-black text-[#3a2f2e] uppercase tracking-widest mb-3 pb-2 border-b border-[#c0c8c9]/30">
              Knowledge Vault Index
            </h4>
            
            <div className="flex-1 overflow-y-auto custom-scroll space-y-3 pr-1">
              {nodes.map(n => (
                <div 
                  key={n.id}
                  onClick={() => {
                    setActiveNode(n);
                    setCurrentView("graph");
                    setMobileTab("graph");
                  }}
                  className={`p-3 rounded border text-xs transition-all cursor-pointer flex items-center justify-between ${
                    activeNode?.id === n.id 
                      ? "bg-[#beeaef]/40 border-[#3b6569] shadow-sm font-semibold" 
                      : "border-[#c0c8c9]/40 hover:bg-[#f6f3f2]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span 
                      className="w-2.5 h-2.5 rounded-full shrink-0" 
                      style={{ backgroundColor: n.color }}
                    />
                    <div className="truncate">
                      <p className="text-[#1c1b1b] font-bold truncate">{n.title}</p>
                      <p className="text-[10px] text-[#404849]/70 font-mono">
                        {n.type.toUpperCase()} • {n.tags.slice(0, 2).join(", ")}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-3 h-3 text-[#3b6569]/40" />
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-[#c0c8c9]/20 flex items-center justify-between text-[11px] text-[#404849]">
              <span>Active Overlap Links:</span>
              <span className="font-mono font-bold bg-[#beeaef] text-[#456e73] px-2 py-0.5 rounded-full">
                {links.length} Relations
              </span>
            </div>
          </div>
        </section>

        {/* Right Side / Middle Area: Dynamic Views */}
        <section className={`flex-1 flex flex-col relative min-h-[450px] lg:flex ${mobileTab === "graph" || mobileTab === "chat" ? "flex" : "hidden"}`}>
          
          {/* VIEW 1: Graph Representation Canvas */}
          {currentView === "graph" && (
            <div className="flex-1 relative bg-[#f6f3f2]/20 backdrop-blur-[2px] overflow-hidden marble-bg flex flex-col">
              
              {/* Interactive SVG Layer */}
              <div className="flex-1 relative cursor-grab active:cursor-grabbing">
                
                {/* Visual Dot Grid background */}
                <div className="absolute inset-0 opacity-40 pointer-events-none" style={{
                  backgroundImage: "radial-gradient(#c0c8c9 1.5px, transparent 1.5px)",
                  backgroundSize: "30px 30px"
                }} />

                {/* SVG Connections */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {links.map((link, idx) => {
                    const sourcePos = getNodePosition(link.source, nodes.findIndex(n => n.id === link.source));
                    const targetPos = getNodePosition(link.target, nodes.findIndex(n => n.id === link.target));
                    
                    const isActiveLink = activeNode && (activeNode.id === link.source || activeNode.id === link.target);

                    return (
                      <g key={`${link.source}-${link.target}-${idx}`}>
                        <line 
                          x1={`${sourcePos.x}%`} 
                          y1={`${sourcePos.y}%`} 
                          x2={`${targetPos.x}%`} 
                          y2={`${targetPos.y}%`} 
                          className={`transition-all ${
                            isActiveLink 
                              ? "stroke-[#714f94] stroke-[2.5]" 
                              : "stroke-[#c0c8c9]/80 stroke-[1.2]"
                          } animated-link`}
                        />
                        {/* Hover helper node tooltip connection indicator */}
                        {isActiveLink && (
                          <circle 
                            cx={`${(sourcePos.x + targetPos.x) / 2}%`} 
                            cy={`${(sourcePos.y + targetPos.y) / 2}%`} 
                            r="3" 
                            className="fill-[#714f94] animate-ping"
                          />
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* Render Nodes as Interactive Clusters */}
                {nodes.map((node, index) => {
                  const pos = getNodePosition(node.id, index);
                  const isActive = activeNode?.id === node.id;

                  return (
                    <div
                      key={node.id}
                      style={{
                        left: `${pos.x}%`,
                        top: `${pos.y}%`,
                        transform: "translate(-50%, -50%)"
                      }}
                      onClick={() => setActiveNode(node)}
                      className={`absolute group cursor-pointer transition-all duration-300 z-10 flex flex-col items-center`}
                    >
                      {/* Node circle outline wrapper */}
                      <div className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-all ${
                        isActive 
                          ? "scale-110 shadow-lg border-4 border-white ring-4 ring-[#3b6569]" 
                          : "scale-100 hover:scale-105 shadow border border-[#c0c8c9]/60 hover:border-[#3b6569]"
                      }`}
                      style={{ backgroundColor: node.color }}
                      >
                        {node.type === "image" ? (
                          <ImageIcon className="w-6 h-6 text-white" />
                        ) : node.type === "audio" ? (
                          <Music className="w-6 h-6 text-white" />
                        ) : (
                          <FileText className="w-6 h-6 text-white" />
                        )}
                      </div>

                      {/* Small floating title badge */}
                      <span className={`mt-2 font-serif text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                        isActive 
                          ? "bg-white border-[#3b6569] text-[#3b6569] font-bold shadow-sm" 
                          : "bg-white/80 border-[#c0c8c9]/40 text-[#1c1b1b]"
                      }`}>
                        {node.title}
                      </span>
                    </div>
                  );
                })}

                {/* Floating Canvas Meta Stats Overlay */}
                <div className="absolute right-6 top-6 w-52 bg-white/95 backdrop-blur border border-[#c0c8c9]/60 p-4 rounded-lg hidden md:block shadow-md">
                  <div className="text-[10px] text-[#3b6569] mb-2 border-b border-[#c0c8c9]/20 pb-1 font-mono font-bold uppercase tracking-wider">
                    Semantic Overview
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#404849]">Image Nodes:</span>
                      <span className="font-bold font-mono">{nodes.filter(n => n.type === "image").length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#404849]">Voice Memos:</span>
                      <span className="font-bold font-mono">{nodes.filter(n => n.type === "audio").length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#404849]">Text Notes:</span>
                      <span className="font-bold font-mono">{nodes.filter(n => n.type === "text").length}</span>
                    </div>
                  </div>
                </div>

                {/* Hint guide overlay */}
                <div className="absolute left-6 bottom-6 text-[11px] text-[#404849]/80 bg-white/80 backdrop-blur px-3 py-1.5 rounded border border-[#c0c8c9]/20">
                  ⚡ Click any node to open its context relationship panel below
                </div>
              </div>

              {/* Bottom Sheet Context slide-up panel (Restyled with Opulent Marble) */}
              <div className={`border-t border-[#c0c8c9]/50 bg-white/75 backdrop-blur-md flex flex-col transition-all duration-300 ${
                activeNode ? "h-[320px]" : "h-0 overflow-hidden"
              }`}>
                {activeNode && (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    
                    {/* Top title and dismiss bar */}
                    <div className="px-6 py-3 bg-[#f6f3f2]/40 backdrop-blur-sm border-b border-[#c0c8c9]/20 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: activeNode.color }}
                        />
                        <h4 className="font-serif text-sm font-bold text-[#1c1b1b]">
                          Node Context: {activeNode.title}
                        </h4>
                        <span className="font-mono text-[9px] text-[#404849]/60 uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-[#c0c8c9]/20">
                          ID: {activeNode.id}
                        </span>
                      </div>
                      <button 
                        onClick={() => setActiveNode(null)}
                        className="text-[#404849] hover:text-[#1c1b1b] p-1 rounded-full hover:bg-[#e5e2e1]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Scrollable content areas */}
                    <div className="flex-1 overflow-y-auto custom-scroll p-5 grid grid-cols-1 md:grid-cols-12 gap-5 bg-[#fcf9f8]/40">
                      
                      {/* Col 1: Real Media Preview */}
                      <div className="md:col-span-4 flex flex-col gap-2">
                        <span className="text-[10px] text-[#404849]/80 font-bold uppercase tracking-wider">
                          Media Preview / Extraction
                        </span>
                        
                        <div className="flex-1 min-h-[100px] border border-[#c0c8c9]/40 rounded-lg overflow-hidden bg-white shadow-inner flex flex-col">
                          {activeNode.type === "image" ? (
                            <div className="flex-1 relative group overflow-hidden flex items-center justify-center bg-[#f6f3f2]">
                              <img 
                                src={activeNode.imageUrl || "https://lh3.googleusercontent.com/aida-public/AB6AXuAOMsMC-JAkVcYjpnDFNsvQXukYlL9K1jMrl4NAgm4sJ61ElpV2e0DyUmkvffKpqYWWQDU5ZM2FeaKd5WCwen18C3FfbTCym8r0SW1bzAkH4nIJkPhdyNbS8r2ZC6vslZost5ocUynibex6S-Om8pIkF9UKZ_Nx1eshU1LHPR33sUw549_qCiZHn8h3i0oaBsZPZhFNXQcVyq_nqijsX-49UYQqS8J0NCzPeHAAB1xSOOfntM3iWec_EnvSYoMpmc8NY46pXas70AfW"} 
                                alt={activeNode.title}
                                className="max-h-[140px] max-w-full object-contain filter grayscale brightness-95 group-hover:grayscale-0 transition-all duration-300"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-[10px] text-white font-mono flex items-center gap-1">
                                  <Eye className="w-3.5 h-3.5" /> High-Res Preview
                                </span>
                              </div>
                            </div>
                          ) : activeNode.type === "audio" ? (
                            <div className="flex-1 p-4 flex flex-col justify-center items-center gap-2 bg-[#f0eded]/30">
                              <button 
                                onClick={handleToggleAudioPlay}
                                className="w-10 h-10 rounded-full bg-[#714f94] text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow"
                              >
                                {isPlayingAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                              </button>
                              
                              {/* Waveform representation */}
                              <div className="w-full flex items-center gap-1 mt-2 px-4">
                                {[15, 30, 45, 20, 60, 40, 80, 50, 25, 70, 35, 10].map((height, idx) => (
                                  <div 
                                    key={idx}
                                    style={{ height: `${height}%` }}
                                    className={`flex-1 rounded-full transition-all duration-300 ${
                                      isPlayingAudio && idx * 8 <= audioPlaybackProgress 
                                        ? "bg-[#714f94]" 
                                        : "bg-[#c0c8c9]"
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className="font-mono text-[9px] text-[#404849]/70">
                                {isPlayingAudio ? `0:0${Math.floor(audioPlaybackProgress / 10)} / 0:10` : "0:03 / 0:10"}
                              </span>
                            </div>
                          ) : (
                            <div className="flex-1 p-3 font-mono text-[10px] text-[#404849] overflow-y-auto custom-scroll leading-relaxed">
                              {activeNode.content}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Col 2: Content Summary & Custom Link Description */}
                      <div className="md:col-span-5 flex flex-col gap-3">
                        <div>
                          <span className="text-[10px] text-[#404849]/80 font-bold uppercase tracking-wider block mb-1">
                            Core Transcription / Interpretation
                          </span>
                          <p className="text-xs text-[#1c1b1b] bg-white p-3 rounded border border-[#c0c8c9]/30 leading-relaxed font-serif shadow-sm max-h-[85px] overflow-y-auto custom-scroll">
                            {activeNode.content}
                          </p>
                        </div>

                        <div>
                          <span className="text-[10px] text-[#404849]/80 font-bold uppercase tracking-wider block mb-1">
                            Link Context Description
                          </span>
                          <textarea
                            value={activeNode.linkDescription || ""}
                            onChange={(e) => handleUpdateDescription(e.target.value)}
                            placeholder="State semantic reason, structural overlap, or temporal connection..."
                            rows={2}
                            className="w-full text-xs p-2 bg-white border border-[#c0c8c9]/40 rounded focus:ring-1 focus:ring-[#3b6569] focus:outline-none resize-none placeholder:text-[#404849]/50 shadow-sm"
                          />
                        </div>
                      </div>

                      {/* Col 3: Metadata Control Center */}
                      <div className="md:col-span-3 flex flex-col justify-between gap-3">
                        
                        {/* Node Color Chooser */}
                        <div>
                          <span className="text-[10px] text-[#404849]/80 font-bold uppercase tracking-wider block mb-1.5">
                            Node Color
                          </span>
                          <div className="flex items-center gap-2">
                            {[
                              { label: "Teal", val: "#3b6569" },
                              { label: "Purple", val: "#714f94" },
                              { label: "Muted Pink", val: "#ffd8ea" },
                              { label: "Sage Green", val: "#beeaef" },
                              { label: "Stone", val: "#e5e2e1" }
                            ].map(clr => (
                              <button
                                key={clr.val}
                                onClick={() => handleUpdateColor(clr.val)}
                                aria-label={clr.label}
                                className={`w-6 h-6 rounded-full border transition-transform ${
                                  activeNode.color === clr.val 
                                    ? "scale-110 ring-2 ring-offset-1 ring-[#3b6569] border-white" 
                                    : "hover:scale-105 border-[#c0c8c9]"
                                }`}
                                style={{ backgroundColor: clr.val }}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Node Tag list */}
                        <div>
                          <span className="text-[10px] text-[#404849]/80 font-bold uppercase tracking-wider block mb-1">
                            Tags
                          </span>
                          <div className="flex flex-wrap gap-1 max-h-[55px] overflow-y-auto custom-scroll mb-1.5">
                            {activeNode.tags.map(tag => (
                              <span 
                                key={tag} 
                                className="px-2 py-0.5 bg-[#beeaef] text-[#456e73] rounded-full text-[10px] font-semibold flex items-center gap-1 group border border-[#c0c8c9]/30"
                              >
                                {tag}
                                <button 
                                  onClick={() => handleRemoveTag(tag)}
                                  className="hover:text-red-600 font-bold text-[8px]"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                          
                          {/* Add tag form */}
                          <div className="flex items-center gap-1">
                            <input 
                              type="text"
                              value={newTagName}
                              onChange={(e) => setNewTagName(e.target.value)}
                              placeholder="New tag..."
                              className="flex-1 text-[11px] px-2 py-1 bg-white border border-[#c0c8c9]/40 rounded focus:ring-1 focus:ring-[#3b6569] focus:outline-none"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleAddTag();
                              }}
                            />
                            <button 
                              onClick={handleAddTag}
                              className="p-1 bg-[#3b6569] text-white rounded hover:bg-[#3b6569]/90 active:scale-95 transition-transform"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Connections & Deletion buttons */}
                        <div className="flex items-center gap-1.5 pt-2 border-t border-[#c0c8c9]/20">
                          {/* Manual relation trigger */}
                          <button
                            onClick={() => {
                              // Auto pre-populate manual mapping target list
                              const other = nodes.find(n => n.id !== activeNode.id);
                              if (other) {
                                setManualLinkTarget(other.id);
                                setManualLinkReason(`Connected to evaluate modular overlap.`);
                              }
                            }}
                            className="flex-1 py-1.5 px-1.5 bg-[#f0eded] text-[#1c1b1b] border border-[#c0c8c9] rounded hover:bg-white text-[10px] uppercase font-bold tracking-wider flex items-center justify-center gap-1"
                            title="Connect manually to another node"
                          >
                            <Link2 className="w-3.5 h-3.5" /> Link
                          </button>

                          <button
                            onClick={handleOpenEditNode}
                            className="px-2.5 py-1.5 bg-[#beeaef] text-[#3b6569] border border-[#3b6569]/30 rounded hover:bg-[#beeaef]/50 text-[10px] uppercase font-bold tracking-wider"
                            title="Edit full node content context"
                          >
                            Edit Context
                          </button>

                          <button
                            onClick={() => handleDeleteNode(activeNode.id)}
                            className="p-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Purge Node"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* List current links with delete option */}
                        <div className="mt-2 border-t border-[#c0c8c9]/25 pt-2">
                          <span className="text-[10px] text-[#404849]/80 font-bold uppercase tracking-wider block mb-1">
                            Active Connections:
                          </span>
                          <div className="max-h-[60px] overflow-y-auto custom-scroll space-y-1">
                            {links.filter(l => l.source === activeNode.id || l.target === activeNode.id).map(link => {
                              const connectedId = link.source === activeNode.id ? link.target : link.source;
                              const connectedNode = nodes.find(n => n.id === connectedId);
                              if (!connectedNode) return null;
                              return (
                                <div key={connectedId} className="flex items-center justify-between bg-[#f0eded]/60 px-2 py-0.5 rounded text-[10px] border border-[#c0c8c9]/20">
                                  <span className="font-medium text-[#3b6569] truncate max-w-[110px]">{connectedNode.title}</span>
                                  <button
                                    onClick={() => handleDeleteLink(connectedId)}
                                    className="text-red-500 hover:text-red-700 font-bold text-[9px]"
                                    title="Remove Connection"
                                  >
                                    Delete
                                  </button>
                                </div>
                              );
                            })}
                            {links.filter(l => l.source === activeNode.id || l.target === activeNode.id).length === 0 && (
                              <span className="text-[9px] text-gray-400 italic">No connections established yet.</span>
                            )}
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Manual Link Draw Overlay drawer subform */}
                    {manualLinkTarget && (
                      <div className="absolute inset-0 bg-white/95 backdrop-blur z-20 p-6 flex flex-col justify-center">
                        <div className="max-w-md mx-auto w-full">
                          <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#c0c8c9]/40">
                            <h5 className="font-serif font-bold text-sm text-[#3b6569]">
                              Manually Draw Relational Link
                            </h5>
                            <button 
                              onClick={() => setManualLinkTarget("")}
                              className="text-[#404849] hover:bg-[#eae7e7] p-1 rounded-full"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <form onSubmit={handleCreateManualLink} className="space-y-4">
                            <div>
                              <label className="block text-[10px] text-[#404849] uppercase font-bold mb-1">
                                Link Active "{activeNode.title}" To:
                              </label>
                              <select
                                value={manualLinkTarget}
                                onChange={(e) => setManualLinkTarget(e.target.value)}
                                className="w-full text-xs p-2 border border-[#c0c8c9] rounded bg-[#fcf9f8] focus:outline-none focus:ring-1 focus:ring-[#3b6569]"
                              >
                                {nodes.filter(n => n.id !== activeNode.id).map(n => (
                                  <option key={n.id} value={n.id}>
                                    {n.title} ({n.type.toUpperCase()})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] text-[#404849] uppercase font-bold mb-1">
                                Overlap Correlation Reason:
                              </label>
                              <textarea
                                value={manualLinkReason}
                                onChange={(e) => setManualLinkReason(e.target.value)}
                                placeholder="Explain how these nodes contextually overlap..."
                                rows={2.5}
                                required
                                className="w-full text-xs p-2 border border-[#c0c8c9] rounded focus:outline-none focus:ring-1 focus:ring-[#3b6569] resize-none"
                              />
                            </div>

                            <button
                              type="submit"
                              className="w-full py-2 bg-[#3b6569] text-white text-xs font-bold uppercase tracking-widest rounded shadow hover:bg-[#3b6569]/90 active:scale-95 transition-all"
                            >
                              Establish Synaptic Link
                            </button>
                          </form>
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>

            </div>
          )}

          {/* VIEW 2: Conversational Semantic Search Chat Stream */}
          {currentView === "chat" && (
            <div className="flex-1 flex flex-col relative bg-white/25 backdrop-blur-[3px] marble-bg">
              
              {/* Message History List */}
              <div className="flex-1 overflow-y-auto custom-scroll p-6 md:p-8 space-y-6">
                {chatMessages.map((msg, idx) => {
                  const isUser = msg.sender === "user";
                  return (
                    <div 
                      key={msg.id || idx} 
                      className={`flex gap-4 max-w-3xl mx-auto items-start ${
                        isUser ? "flex-row-reverse" : ""
                      }`}
                    >
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-full border flex items-center justify-center flex-shrink-0 shadow-sm ${
                        isUser 
                          ? "bg-[#eae7e7] border-[#c0c8c9]" 
                          : "bg-[#beeaef] border-[#3b6569]"
                      }`}>
                        {isUser ? (
                          <span className="font-serif text-[11px] font-bold text-[#404849]">C</span>
                        ) : (
                          <Cpu className="w-4 h-4 text-[#3b6569]" />
                        )}
                      </div>

                      {/* Msg text bubble */}
                      <div className={`space-y-2 max-w-[80%] ${isUser ? "text-right" : ""}`}>
                        <div className="font-mono text-[10px] text-[#404849]/70 uppercase tracking-widest font-bold">
                          {isUser ? "Ciara" : "Brain Assistant"} • {msg.timestamp}
                        </div>
                        
                        <div className={`p-4 rounded-lg text-xs leading-relaxed font-serif shadow-sm border ${
                          isUser 
                            ? "bg-[#3b6569]/10 border-[#3b6569]/20 text-[#1c1b1b] rounded-tr-none" 
                            : "bg-[#f6f3f2] border-[#c0c8c9]/40 text-[#1c1b1b] rounded-tl-none"
                        }`}>
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                        </div>

                        {/* Citations block */}
                        {msg.citations && msg.citations.length > 0 && (
                          <div className={`flex flex-wrap gap-2 pt-1 ${isUser ? "justify-end" : ""}`}>
                            {msg.citations.map((cite, cIdx) => (
                              <button
                                key={cIdx}
                                onClick={() => {
                                  // Locate node in graph and focus it
                                  const citeNode = nodes.find(n => n.id === cite.id);
                                  if (citeNode) {
                                    setActiveNode(citeNode);
                                    setCurrentView("graph");
                                    setMobileTab("graph");
                                  }
                                }}
                                className="px-2.5 py-1 bg-white border border-[#c0c8c9]/50 hover:border-[#714f94] hover:shadow-sm rounded-full text-[10px] text-[#404849] hover:text-[#714f94] transition-all flex items-center gap-1"
                              >
                                {cite.type === "image" ? (
                                  <ImageIcon className="w-3 h-3 text-[#3b6569]" />
                                ) : cite.type === "audio" ? (
                                  <Music className="w-3 h-3 text-[#714f94]" />
                                ) : (
                                  <FileText className="w-3 h-3 text-[#854c6c]" />
                                )}
                                <span className="font-mono">{cite.title}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Suggestions Chips Row */}
              <div className="px-6 py-2 border-t border-[#c0c8c9]/20 bg-[#f6f3f2]/30 backdrop-blur-sm flex gap-2 overflow-x-auto custom-scroll">
                {[
                  "Find my notes on neural networks from the last symposium.",
                  "Explain connections mapped to Alpha-7",
                  "Explain concrete thermal calculations"
                ].map(sug => (
                  <button
                    key={sug}
                    onClick={(e) => handleSendChat(e, sug)}
                    className="shrink-0 text-[10px] font-serif bg-white hover:bg-[#beeaef]/30 text-[#3b6569] px-3 py-1 rounded-full border border-[#c0c8c9]/30 transition-all font-semibold shadow-sm"
                  >
                    {sug}
                  </button>
                ))}
              </div>

              {/* User Chat Entry Form */}
              <div className="p-4 md:p-6 bg-[#f6f3f2]/35 backdrop-blur-md border-t border-[#c0c8c9]/50">
                <form onSubmit={handleSendChat} className="max-w-3xl mx-auto relative group">
                  <div className="absolute inset-0 bg-[#3b6569]/10 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity rounded-full pointer-events-none" />
                  <div className="relative flex items-center bg-white border border-[#c0c8c9] rounded-full p-1 pl-5 pr-2 focus-within:border-[#3b6569] focus-within:ring-2 focus-within:ring-[#beeaef] transition-all shadow-sm">
                    <Search className="w-4 h-4 text-[#404849]/60 mr-2 shrink-0" />
                    <input 
                      type="text" 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Semantic inquiry or connection matching..."
                      className="flex-1 bg-transparent border-none text-xs focus:ring-0 focus:outline-none text-[#1c1b1b] py-3 placeholder:text-[#404849]/40"
                    />
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="hidden sm:block text-[9px] font-mono text-[#c0c8c9] font-bold uppercase tracking-wider select-none pr-1">
                        CMD + K
                      </span>
                      <button 
                        type="submit"
                        disabled={loadingChat || !chatInput.trim()}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                          !chatInput.trim() 
                            ? "bg-[#eae7e7] text-[#404849]/30" 
                            : "bg-[#3b6569] text-white hover:scale-105 active:scale-95 shadow"
                        }`}
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </form>
              </div>

            </div>
          )}

        </section>

      </div>
      )}

      {/* MODAL 1: Intake processed outcome Confirmation panel */}
      {processedOutcome && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#c0c8c9] shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            
            {/* Header */}
            <div className="p-5 bg-[#3b6569] text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                <h3 className="font-serif font-bold text-lg">
                  Curatorial Pipeline Extracted Outcome
                </h3>
              </div>
              <button 
                onClick={() => setProcessedOutcome(null)}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/15"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Main Content */}
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto custom-scroll bg-[#fcf9f8]">
              
              {/* Outcome status warning */}
              <div className="bg-[#beeaef]/30 p-3.5 rounded border border-[#3b6569]/30 text-xs text-[#3b6569] flex gap-2">
                <Cpu className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Automated Relational Sync Mapped</p>
                  <p className="text-[11px] opacity-90">Verify the structured parameters extracted from the document before incorporating into the permanent graph.</p>
                </div>
              </div>

              {/* Title & Color Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-[#404849] uppercase font-bold mb-1">
                    Suggested Node Title
                  </label>
                  <input 
                    type="text" 
                    value={processedOutcome.suggested_title} 
                    onChange={(e) => setProcessedOutcome({ ...processedOutcome, suggested_title: e.target.value })}
                    className="w-full text-xs p-2.5 bg-white border border-[#c0c8c9] rounded focus:outline-none focus:ring-1 focus:ring-[#3b6569]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#404849] uppercase font-bold mb-1">
                    Color Coding Theme
                  </label>
                  <div className="flex items-center gap-2 h-[38px]">
                    {[
                      { val: "#3b6569", label: "Teal" },
                      { val: "#714f94", label: "Purple" },
                      { val: "#ffd8ea", label: "Pink" },
                      { val: "#beeaef", label: "Sage" },
                      { val: "#e5e2e1", label: "Stone" }
                    ].map(c => (
                      <button
                        key={c.val}
                        onClick={() => setProcessedOutcome({ ...processedOutcome, suggested_color: c.val })}
                        className={`w-6 h-6 rounded-full border transition-transform ${
                          processedOutcome.suggested_color === c.val 
                            ? "scale-110 ring-2 ring-offset-1 ring-[#3b6569]" 
                            : "opacity-60 border-[#c0c8c9]"
                        }`}
                        style={{ backgroundColor: c.val }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* OCR transcription outcome */}
              <div>
                <label className="block text-[10px] text-[#404849] uppercase font-bold mb-1">
                  Raw OCR / Verbatim Transcript
                </label>
                <textarea 
                  value={processedOutcome.raw_transcription_or_ocr}
                  onChange={(e) => setProcessedOutcome({ ...processedOutcome, raw_transcription_or_ocr: e.target.value })}
                  rows={4}
                  className="w-full text-xs p-3 bg-white border border-[#c0c8c9] rounded font-mono leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-[#3b6569]"
                />
              </div>

              {/* Extracted Entity tags */}
              <div>
                <label className="block text-[10px] text-[#404849] uppercase font-bold mb-1">
                  Extracted Entities &amp; Metadata Tags
                </label>
                <div className="flex flex-wrap gap-1.5 p-3 bg-white border border-[#c0c8c9] rounded min-h-[40px]">
                  {processedOutcome.extracted_entities.map((ent, idx) => (
                    <span 
                      key={idx}
                      className="px-2.5 py-0.5 bg-[#f0eded] text-[#1c1b1b] border border-[#c0c8c9]/60 rounded-full text-[10px] font-mono"
                    >
                      {ent}
                    </span>
                  ))}
                  <button 
                    onClick={() => {
                      const additional = prompt("Enter additional entity:");
                      if (additional) {
                        setProcessedOutcome({
                          ...processedOutcome,
                          extracted_entities: [...processedOutcome.extracted_entities, additional]
                        });
                      }
                    }}
                    className="px-2.5 py-0.5 border border-dashed border-[#3b6569] text-[#3b6569] rounded-full text-[10px] hover:bg-[#beeaef]/20"
                  >
                    + Add Entity
                  </button>
                </div>
              </div>

              {/* Suggested link relations */}
              <div>
                <label className="block text-[10px] text-[#404849] uppercase font-bold mb-1">
                  Suggested Graph Node Connections
                </label>
                <div className="space-y-2">
                  {processedOutcome.suggested_node_links && processedOutcome.suggested_node_links.length > 0 ? (
                    processedOutcome.suggested_node_links.map((link, idx) => (
                      <div key={idx} className="p-3 bg-white border border-[#c0c8c9] rounded text-xs flex justify-between items-start">
                        <div>
                          <p className="font-bold text-[#3b6569]">Connects to: {link.target_node_id}</p>
                          <p className="text-[11px] text-[#404849] leading-relaxed mt-0.5">{link.reason_for_connection}</p>
                        </div>
                        <span className="font-mono text-[9px] bg-[#ffd8ea] text-[#8f5675] px-2 py-0.5 rounded uppercase font-bold">
                          {idx === 0 ? "Primary Suggestion" : "Suggested"}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[#404849] italic bg-white p-3 border border-[#c0c8c9] rounded">
                      No direct connection overlap identified in current archive. Node will sit detached in curatorial workspace.
                    </p>
                  )}
                </div>
              </div>

            </div>

            {/* Bottom confirmation actions */}
            <div className="p-5 bg-[#f0eded] border-t border-[#c0c8c9]/40 flex gap-3 justify-end">
              <button
                onClick={() => setProcessedOutcome(null)}
                className="px-4 py-2 bg-white text-[#404849] border border-[#c0c8c9] text-xs font-bold uppercase tracking-widest rounded hover:bg-[#eae7e7] transition-all"
              >
                Discard
              </button>
              <button
                onClick={handleIntegrateProcessedOutcome}
                className="px-6 py-2 bg-[#3b6569] text-white text-xs font-bold uppercase tracking-widest rounded hover:bg-[#3b6569]/90 active:scale-95 transition-all flex items-center gap-1.5 shadow"
              >
                <Check className="w-4 h-4" /> Integrate into Second Brain
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: Curatorial Pipeline Onboarding Guidelines */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#c0c8c9] shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 bg-[#3b6569] text-white flex justify-between items-center">
              <h3 className="font-serif font-bold text-base flex items-center gap-2">
                <HelpCircle className="w-5 h-5" /> Curatorial Guidelines
              </h3>
              <button onClick={() => setShowHelp(false)} className="text-white hover:text-white/80">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs leading-relaxed text-[#404849]">
              <div>
                <h4 className="font-bold text-[#1c1b1b] mb-1">1. OCR Image Extraction</h4>
                <p>Upload a png/jpg blueprint or schematic. The pipeline analyzes layout objects, identifies labels via OCR, defines overarching structural themes, and produces metadata tags automatically.</p>
              </div>
              <div>
                <h4 className="font-bold text-[#1c1b1b] mb-1">2. Voice Note Verbatim Transcriber</h4>
                <p>Upload short voice clips talking through research models. Verbatim transcriptions convert vocal theories, architectural descriptions, and actionable lists into structured node assets.</p>
              </div>
              <div>
                <h4 className="font-bold text-[#1c1b1b] mb-1">3. Relational Mapping Engine</h4>
                <p>Incoming files are cross-referenced with your existing vault archive context. We evaluate overlaps, categories, or temporal same-day events to suggest high-probability connections.</p>
              </div>
              <div className="bg-[#beeaef]/30 p-3 rounded border border-[#3b6569]/20 text-[11px] text-[#3b6569]">
                💡 <strong>Search Query Tip:</strong> Use the Chat view to type search phrases. For instance, "Find my notes on neural networks" will locate nodes, highlight them, and scroll your canvas view to focus them immediately!
              </div>
            </div>
            <div className="p-4 bg-[#f0eded] border-t border-[#c0c8c9]/40 flex justify-end">
              <button 
                onClick={() => setShowHelp(false)}
                className="px-5 py-2 bg-[#3b6569] text-white text-xs font-bold uppercase tracking-widest rounded hover:bg-[#3b6569]/90 transition-all"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Developer / Secrets configuration helper */}
      {showConfig && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#c0c8c9] shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 bg-[#3b6569] text-white flex justify-between items-center">
              <h3 className="font-serif font-bold text-base flex items-center gap-2">
                <Settings className="w-5 h-5" /> Brain Configuration
              </h3>
              <button onClick={() => setShowConfig(false)} className="text-white hover:text-white/80">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs leading-relaxed text-[#404849]">
              <p>Your Second Brain application uses highly advanced server-side Gemini models (<code>models/gemini-3.5-flash</code>) to perform OCR on schematics and transcribe audio files.</p>
              
              <div className="bg-[#eae7e7] p-3 rounded border border-[#c0c8c9] font-mono text-[10px]">
                <p className="font-bold mb-1">Current App Status:</p>
                <p>• Model: gemini-3.5-flash</p>
                <p>• Port: 3000 (Proxy Active)</p>
                <p>• Sync State: ACTIVE_LOCAL</p>
              </div>

              <p className="text-[11px] text-[#404849]/80">Configure your <code>GEMINI_API_KEY</code> in the Secrets section of the AI Studio workspace interface to activate fully automated real-time Gemini processing instead of the built-in curatorial fallback framework.</p>
            </div>
            <div className="p-4 bg-[#f0eded] border-t border-[#c0c8c9]/40 flex justify-end">
              <button 
                onClick={() => setShowConfig(false)}
                className="px-5 py-2 bg-[#3b6569] text-white text-xs font-bold uppercase tracking-widest rounded hover:bg-[#3b6569]/90 transition-all"
              >
                Close Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Full Node Context Editor */}
      {isEditingNode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#c0c8c9] shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 bg-[#3b6569] text-white flex justify-between items-center">
              <h3 className="font-serif font-bold text-base flex items-center gap-2">
                <Settings className="w-5 h-5 text-white" /> Edit Node Context Details
              </h3>
              <button onClick={() => setIsEditingNode(false)} className="text-white hover:text-white/80">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveNodeEdit}>
              <div className="p-6 space-y-4 text-xs bg-[#fcf9f8]">
                <div>
                  <label className="block text-[10px] text-[#404849] uppercase font-bold mb-1">
                    Node Title
                  </label>
                  <input
                    type="text"
                    required
                    value={editNodeForm.title}
                    onChange={(e) => setEditNodeForm({ ...editNodeForm, title: e.target.value })}
                    className="w-full text-xs p-2.5 bg-white border border-[#c0c8c9] rounded focus:outline-none focus:ring-1 focus:ring-[#3b6569]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-[#404849] uppercase font-bold mb-1">
                    Core Content / Transcription / Context
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={editNodeForm.content}
                    onChange={(e) => setEditNodeForm({ ...editNodeForm, content: e.target.value })}
                    className="w-full text-xs p-2.5 bg-white border border-[#c0c8c9] rounded focus:outline-none focus:ring-1 focus:ring-[#3b6569] resize-none font-sans leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-[#404849] uppercase font-bold mb-1">
                    Color Coding Theme
                  </label>
                  <div className="flex items-center gap-2.5 mt-1">
                    {[
                      { val: "#3b6569", label: "Teal" },
                      { val: "#714f94", label: "Purple" },
                      { val: "#ffd8ea", label: "Pink" },
                      { val: "#beeaef", label: "Sage" },
                      { val: "#e5e2e1", label: "Stone" }
                    ].map(c => (
                      <button
                        type="button"
                        key={c.val}
                        onClick={() => setEditNodeForm({ ...editNodeForm, color: c.val })}
                        className={`w-6 h-6 rounded-full border transition-transform ${
                          editNodeForm.color === c.val
                            ? "scale-110 ring-2 ring-offset-1 ring-[#3b6569]"
                            : "opacity-60 border-[#c0c8c9]"
                        }`}
                        style={{ backgroundColor: c.val }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-[#404849] uppercase font-bold mb-1">
                    Link Overlap Description
                  </label>
                  <input
                    type="text"
                    value={editNodeForm.linkDescription}
                    onChange={(e) => setEditNodeForm({ ...editNodeForm, linkDescription: e.target.value })}
                    placeholder="Describe how this relates to neighboring connections..."
                    className="w-full text-xs p-2.5 bg-white border border-[#c0c8c9] rounded focus:outline-none focus:ring-1 focus:ring-[#3b6569]"
                  />
                </div>
              </div>

              <div className="p-4 bg-[#f0eded] border-t border-[#c0c8c9]/40 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingNode(false)}
                  className="px-4 py-2 bg-white text-[#404849] border border-[#c0c8c9] rounded text-xs font-bold uppercase tracking-wider hover:bg-[#eae7e7] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#3b6569] text-white rounded text-xs font-bold uppercase tracking-wider hover:bg-[#3b6569]/90 shadow transition-all"
                >
                  Save Context Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Navigation Tab Bar (Elegant, floating glass design) */}
      {!showLanding && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#fcf9f8]/95 backdrop-blur-md border-t border-[#c0c8c9]/50 flex justify-around items-center py-2 z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] px-4">
          <button
            onClick={() => setMobileTab("intake")}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-all ${
              mobileTab === "intake"
                ? "text-[#3b6569] font-bold"
                : "text-[#404849]/60 hover:text-[#404849]"
            }`}
          >
            <Upload className={`w-5 h-5 transition-transform ${mobileTab === "intake" ? "scale-110 text-[#3b6569]" : ""}`} />
            <span className="text-[10px] tracking-wider uppercase font-sans font-bold">Capture</span>
          </button>

          <button
            onClick={() => {
              setMobileTab("graph");
              setCurrentView("graph");
            }}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-all ${
              mobileTab === "graph"
                ? "text-[#3b6569] font-bold"
                : "text-[#404849]/60 hover:text-[#404849]"
            }`}
          >
            <Cpu className={`w-5 h-5 transition-transform ${mobileTab === "graph" ? "scale-110 text-[#3b6569]" : ""}`} />
            <span className="text-[10px] tracking-wider uppercase font-sans font-bold">Graph Map</span>
          </button>

          <button
            onClick={() => {
              setMobileTab("chat");
              setCurrentView("chat");
            }}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-all ${
              mobileTab === "chat"
                ? "text-[#3b6569] font-bold"
                : "text-[#404849]/60 hover:text-[#404849]"
            }`}
          >
            <MessageSquare className={`w-5 h-5 transition-transform ${mobileTab === "chat" ? "scale-110 text-[#3b6569]" : ""}`} />
            <span className="text-[10px] tracking-wider uppercase font-sans font-bold">AI Chat</span>
          </button>

          <button
            onClick={() => setMobileTab("index")}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-all ${
              mobileTab === "index"
                ? "text-[#3b6569] font-bold"
                : "text-[#404849]/60 hover:text-[#404849]"
            }`}
          >
            <FileText className={`w-5 h-5 transition-transform ${mobileTab === "index" ? "scale-110 text-[#3b6569]" : ""}`} />
            <span className="text-[10px] tracking-wider uppercase font-sans font-bold">Index</span>
          </button>
        </div>
      )}

    </div>
  );
}
