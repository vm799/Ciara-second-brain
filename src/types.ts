export interface BrainNode {
  id: string;
  title: string;
  content: string;
  type: 'image' | 'audio' | 'text';
  imageUrl?: string;
  audioUrl?: string;
  color: string;
  tags: string[];
  createdAt: string;
  linkDescription?: string;
}

export interface NodeLink {
  source: string;
  target: string;
  reason: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'system';
  text: string;
  timestamp: string;
  citations?: { id: string; title: string; type: 'image' | 'audio' | 'text' }[];
  highlightedNodeId?: string;
}
