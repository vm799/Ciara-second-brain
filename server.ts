import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

// Initialize express app
const app = express();
const PORT = 3000;

// Middleware for parsing JSON with a limit for base64 file uploads
app.use(express.json({ limit: "50mb" }));

// Initialize Gemini API client (safely checks if API key is present)
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
  console.log("Gemini API Client initialized successfully.");
} else {
  console.warn("WARNING: GEMINI_API_KEY environment variable is missing or placeholder. Running in mock/fallback mode.");
}

// In-memory data store for nodes
interface BrainNode {
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

interface NodeLink {
  source: string;
  target: string;
  reason: string;
}

interface Subject {
  id: string;
  name: string;
  nodes: BrainNode[];
  links: NodeLink[];
}

let subjects: Record<string, Subject> = {
  "isabel-moore": {
    id: "isabel-moore",
    name: "Isabel Moore Weaving Vault",
    nodes: [
      {
        id: "ISABELLE-MAIN",
        title: "ISABELLE_BIO.txt",
        content: "Isabelle More is a British textile artist based in St Ives, Cornwall. She integrates traditional tapestry weaving techniques with raw organic wool, seaweed-dyed flax linen, and reclaimed copper wire threads to create 3D sculptural reliefs that reflect coastal erosion patterns.",
        type: "text",
        color: "#3b6569",
        tags: ["#artist-bio", "#textiles", "#st-ives", "#materials"],
        linkDescription: "Core artist profile specifying St Ives studio location, raw natural fibers, and the primary focus on coastal erosion patterns.",
        createdAt: "2026-07-01T10:00:00Z"
      },
      {
        id: "TAPESTRY-04",
        title: "EROSION_MAP_V2.png",
        content: "A detailed visual map of St Ives coastal cliff lines overlayed with structural weaving weave grids, showing where hand-spun coarse wool yarns will cross warp threads to simulate granite crevices.",
        type: "image",
        imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuAOMsMC-JAkVcYjpnDFNsvQXukYlL9K1jMrl4NAgm4sJ61ElpV2e0DyUmkvffKpqYWWQDU5ZM2FeaKd5WCwen18C3FfbTCym8r0SW1bzAkH4nIJkPhdyNbS8r2ZC6vslZost5ocUynibex6S-Om8pIkF9UKZ_Nx1eshU1LHPR33sUw549_qCiZHn8h3i0oaBsZPZhFNXQcVyq_nqijsX-49UYQqS8J0NCzPeHAAB1xSOOfntM3iWec_EnvSYoMpmc8NY46pXas70AfW",
        color: "#beeaef",
        tags: ["#blueprint", "#tapestry-grid", "#crevice-weaving", "#landscape"],
        linkDescription: "Structural design template illustrating how high-density warp structures correspond directly to actual geological cliff erosion zones.",
        createdAt: "2026-07-03T09:15:00Z"
      },
      {
        id: "AUD-WOOL",
        title: "WEAVING_SOUNDSCAPE_01.wav",
        content: "Voice memo recording St Ives studio ambient soundscape paired with notes explaining the dye formulation of local bladderwrack kelp seaweed to obtain rich organic moss-greens and deep mineral-grays on Herdwick sheep wool.",
        type: "audio",
        color: "#714f94",
        tags: ["#voice-memo", "#seaweed-dye", "#herdwick-wool", "#organic"],
        linkDescription: "Details the chemical and environmental process of St Ives seaweed harvesting to dye Herdwick wool threads specified in the Erosion Map.",
        createdAt: "2026-07-02T14:30:00Z"
      },
      {
        id: "WORKSHOP-LOG",
        title: "CORNISH_SYMPOSIUM_LOG.txt",
        content: "Cornwall Crafts Guild symposium notes: Discussing tactile relief weaving, copper wire warp stabilization, and the role of British textile history in post-industrial coastal communities.",
        type: "text",
        color: "#ffd8ea",
        tags: ["#guild-symposium", "#copper-wire", "#community", "#history"],
        linkDescription: "Notes outlining stabilization properties of weaving structure using fine copper warp wires to support heavy Herdwick wool sculptural panels.",
        createdAt: "2026-07-04T16:45:00Z"
      }
    ],
    links: [
      { source: "TAPESTRY-04", target: "ISABELLE-MAIN", reason: "Specifies the physical structural design used by Isabelle to translate the St Ives coastal aesthetic into 3D tapestry reliefs." },
      { source: "AUD-WOOL", target: "TAPESTRY-04", reason: "Details the St Ives organic bladderwrack dye process for the Herdwick wool threads woven into the erosion grids." },
      { source: "WORKSHOP-LOG", target: "ISABELLE-MAIN", reason: "Documents theoretical and historic framing of St Ives crafts communities supporting her work." },
      { source: "AUD-WOOL", target: "WORKSHOP-LOG", reason: "Discusses natural dyeing chemical compounds presented at the Cornish Crafts Symposium." }
    ]
  },
  "museum-exhibits": {
    id: "museum-exhibits",
    name: "British Museum Exhibits",
    nodes: [
      {
        id: "INSCRIPTION-01",
        title: "ROSETTA_STONE_INSCRIPTION.txt",
        content: "Rosetta Stone inscription transcript: Hieroglyphic, Demotic, and Greek translations of a decree issued at Memphis in 196 BC on behalf of King Ptolemy V.",
        type: "text",
        color: "#beeaef",
        tags: ["#egypt", "#decree", "#ptolemy", "#languages"],
        linkDescription: "Details Ptolemy's royal decree across three scripts used as the key to deciphering Egyptian hieroglyphs.",
        createdAt: "2026-07-05T14:20:00Z"
      },
      {
        id: "MUSEUM-PHOTO",
        title: "ROOM_4_DECREE_VISUAL.png",
        content: "High-contrast digital photography of the basalt slab in the British Museum. The black granodiorite rock face clearly highlights the deep chisel marks of the Greek translation at the bottom.",
        type: "image",
        imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuAOMsMC-JAkVcYjpnDFNsvQXukYlL9K1jMrl4NAgm4sJ61ElpV2e0DyUmkvffKpqYWWQDU5ZM2FeaKd5WCwen18C3FfbTCym8r0SW1bzAkH4nIJkPhdyNbS8r2ZC6vslZost5ocUynibex6S-Om8pIkF9UKZ_Nx1eshU1LHPR33sUw549_qCiZHn8h3i0oaBsZPZhFNXQcVyq_nqijsX-49UYQqS8J0NCzPeHAAB1xSOOfntM3iWec_EnvSYoMpmc8NY46pXas70AfW",
        color: "#3b6569",
        tags: ["#photo", "#basalt", "#greek", "#decree-face"],
        linkDescription: "Visual reference mapping Greek inscription carvings to translate ancient Demotic texts.",
        createdAt: "2026-07-05T15:10:00Z"
      },
      {
        id: "MUSEUM-VOICE",
        title: "EXHIBIT_GUIDE_AUDIO.wav",
        content: "Voice note describing the crowded Room 4 exhibition hall. Discusses how Thomas Young and Jean-François Champollion manually decoded the pharaoh cartouches by matching recurring Greek symbols.",
        type: "audio",
        color: "#714f94",
        tags: ["#voice-notes", "#guide", "#young", "#champollion"],
        linkDescription: "Audio commentary detailing historical deciphering race by Young and Champollion matching the Rosetta stone's carved greek titles.",
        createdAt: "2026-07-05T15:45:00Z"
      }
    ],
    links: [
      { source: "MUSEUM-PHOTO", target: "INSCRIPTION-01", reason: "Direct photograph highlighting demotic and greek inscription text lines." },
      { source: "MUSEUM-VOICE", target: "INSCRIPTION-01", reason: "Explains how Young and Champollion manually deciphered the Ptolemy cartouches." }
    ]
  },
  "garden-ideas": {
    id: "garden-ideas",
    name: "Brutalist Botanical Garden",
    nodes: [
      {
        id: "Alpha-7",
        title: "Alpha-7",
        content: "A blueprint of Neo-Arcadia Urban Garden, focusing on vertical irrigation, brutalist structural columns, and environmental bio-integration zones.",
        type: "image",
        imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuAOMsMC-JAkVcYjpnDFNsvQXukYlL9K1jMrl4NAgm4sJ61ElpV2e0DyUmkvffKpqYWWQDU5ZM2FeaKd5WCwen18C3FfbTCym8r0SW1bzAkH4nIJkPhdyNbS8r2ZC6vslZost5ocUynibex6S-Om8pIkF9UKZ_Nx1eshU1LHPR33sUw549_qCiZHn8h3i0oaBsZPZhFNXQcVyq_nqijsX-49UYQqS8J0NCzPeHAAB1xSOOfntM3iWec_EnvSYoMpmc8NY46pXas70AfW",
        color: "#3b6569",
        tags: ["#architecture", "#concept", "#ref-12"],
        linkDescription: "Initial sketch for the urban garden project. Exploring vertical irrigation and brutalist aesthetics.",
        createdAt: "2026-07-01T10:00:00Z"
      },
      {
        id: "AUD-092",
        title: "AUD_092.wav",
        content: "Voice note discussing modular brutalist concrete, microclimate absorption properties, and solar-active materials on vertical surfaces.",
        type: "audio",
        color: "#714f94",
        tags: ["#energy", "#materials", "#voice"],
        linkDescription: "Details of thermal mass absorption properties calculated to support the plant microclimate of Alpha-7.",
        createdAt: "2026-07-02T14:30:00Z"
      }
    ],
    links: [
      { source: "AUD-092", target: "Alpha-7", reason: "Explains structural concrete materials used to maintain the botanical microclimates of Alpha-7." }
    ]
  }
};

// Helper to resolve active nodes/links array for a request
function getActiveSubject(req: any) {
  const subjectId = (req.query.subjectId || req.body.subjectId || "isabel-moore") as string;
  if (!subjects[subjectId]) {
    // Generate new on-the-fly
    const cleanName = subjectId
      .split("-")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    subjects[subjectId] = {
      id: subjectId,
      name: cleanName,
      nodes: [],
      links: []
    };
  }
  return subjects[subjectId];
}

// Helper to make unique ID
function makeId(title: string): string {
  return title
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .toUpperCase();
}

// REST API endpoints

// List all active subjects/vaults
app.get("/api/subjects", (req, res) => {
  res.json(Object.values(subjects).map(s => ({ id: s.id, name: s.name })));
});

// Create a new custom subject/vault
app.post("/api/subjects", (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Subject name is required" });
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  if (!subjects[id]) {
    subjects[id] = {
      id,
      name,
      nodes: [],
      links: []
    };
  }
  res.json({ success: true, subject: { id, name: subjects[id].name }, subjects: Object.values(subjects).map(s => ({ id: s.id, name: s.name })) });
});

// Fetch nodes and links for active subject
app.get("/api/nodes", (req, res) => {
  const activeSub = getActiveSubject(req);
  res.json({ nodes: activeSub.nodes, links: activeSub.links });
});

// Create/Update node inside active subject
app.post("/api/nodes", (req, res) => {
  const activeSub = getActiveSubject(req);
  const { id, title, content, type, imageUrl, audioUrl, color, tags, linkDescription, targetNodeId, reasonForConnection } = req.body;
  
  if (!title || !content || !type) {
    return res.status(400).json({ error: "Missing required fields: title, content, type" });
  }

  const nodeId = id || makeId(title);
  
  // Check if exists
  const exists = activeSub.nodes.find(n => n.id === nodeId);
  if (exists) {
    // Update
    exists.title = title;
    exists.content = content;
    exists.color = color || exists.color;
    exists.tags = tags || exists.tags;
    exists.linkDescription = linkDescription || exists.linkDescription;
    return res.json({ success: true, node: exists, nodes: activeSub.nodes, links: activeSub.links });
  }

  const newNode: BrainNode = {
    id: nodeId,
    title,
    content,
    type,
    imageUrl,
    audioUrl,
    color: color || "#3b6569",
    tags: tags || [],
    linkDescription: linkDescription || "",
    createdAt: new Date().toISOString()
  };

  activeSub.nodes.push(newNode);

  if (targetNodeId && reasonForConnection) {
    // Add link
    const newLink: NodeLink = {
      source: nodeId,
      target: targetNodeId,
      reason: reasonForConnection
    };
    // Ensure no duplicate link
    const linkExists = activeSub.links.some(l => 
      (l.source === nodeId && l.target === targetNodeId) || 
      (l.source === targetNodeId && l.target === nodeId)
    );
    if (!linkExists) {
      activeSub.links.push(newLink);
    }
  }

  res.json({ success: true, node: newNode, nodes: activeSub.nodes, links: activeSub.links });
});

// Delete a node inside active subject
app.delete("/api/nodes/:id", (req, res) => {
  const { id } = req.params;
  const activeSub = getActiveSubject(req);
  activeSub.nodes = activeSub.nodes.filter(n => n.id !== id);
  activeSub.links = activeSub.links.filter(l => l.source !== id && l.target !== id);
  res.json({ success: true, nodes: activeSub.nodes, links: activeSub.links });
});

// Fully edit a node's full context inside active subject
app.post("/api/nodes/:id/edit", (req, res) => {
  const { id } = req.params;
  const activeSub = getActiveSubject(req);
  const { title, content, color, tags, linkDescription } = req.body;
  
  const node = activeSub.nodes.find(n => n.id === id);
  if (!node) return res.status(404).json({ error: "Node not found" });

  if (title) node.title = title;
  if (content !== undefined) node.content = content;
  if (color) node.color = color;
  if (tags) node.tags = tags;
  if (linkDescription !== undefined) node.linkDescription = linkDescription;

  res.json({ success: true, node, nodes: activeSub.nodes, links: activeSub.links });
});

app.post("/api/nodes/:id/color", (req, res) => {
  const { id } = req.params;
  const { color } = req.body;
  const activeSub = getActiveSubject(req);
  const node = activeSub.nodes.find(n => n.id === id);
  if (!node) return res.status(404).json({ error: "Node not found" });
  node.color = color;
  res.json({ success: true, node, nodes: activeSub.nodes, links: activeSub.links });
});

app.post("/api/nodes/:id/tags", (req, res) => {
  const { id } = req.params;
  const { tags } = req.body;
  const activeSub = getActiveSubject(req);
  const node = activeSub.nodes.find(n => n.id === id);
  if (!node) return res.status(404).json({ error: "Node not found" });
  node.tags = tags;
  res.json({ success: true, node, nodes: activeSub.nodes, links: activeSub.links });
});

app.post("/api/nodes/:id/description", (req, res) => {
  const { id } = req.params;
  const { linkDescription } = req.body;
  const activeSub = getActiveSubject(req);
  const node = activeSub.nodes.find(n => n.id === id);
  if (!node) return res.status(404).json({ error: "Node not found" });
  node.linkDescription = linkDescription;
  res.json({ success: true, node, nodes: activeSub.nodes, links: activeSub.links });
});

// Create/Update connections manually
app.post("/api/nodes/:id/links", (req, res) => {
  const { id } = req.params;
  const { targetId, reason } = req.body;
  const activeSub = getActiveSubject(req);
  if (!targetId || !reason) return res.status(400).json({ error: "Missing targetId or reason" });

  const nodeExists1 = activeSub.nodes.some(n => n.id === id);
  const nodeExists2 = activeSub.nodes.some(n => n.id === targetId);
  if (!nodeExists1 || !nodeExists2) {
    return res.status(404).json({ error: "One or both nodes not found" });
  }

  // Check if link exists
  const linkIdx = activeSub.links.findIndex(l => 
    (l.source === id && l.target === targetId) || 
    (l.source === targetId && l.target === id)
  );

  if (linkIdx >= 0) {
    activeSub.links[linkIdx].reason = reason;
  } else {
    activeSub.links.push({ source: id, target: targetId, reason });
  }

  res.json({ success: true, nodes: activeSub.nodes, links: activeSub.links });
});

// Delete connection manually
app.delete("/api/nodes/:id/links", (req, res) => {
  const { id } = req.params;
  const targetId = req.query.targetId || req.body.targetId;
  const activeSub = getActiveSubject(req);
  
  if (!targetId) return res.status(400).json({ error: "Missing targetId parameter" });

  activeSub.links = activeSub.links.filter(l => 
    !((l.source === id && l.target === targetId) || (l.source === targetId && l.target === id))
  );

  res.json({ success: true, nodes: activeSub.nodes, links: activeSub.links });
});

// Process file uploads & multi-media analysis via Gemini
app.post("/api/process", async (req, res) => {
  const { type, fileName, base64Data, mimeType, content } = req.body;

  if (!type) {
    return res.status(400).json({ error: "Missing payload type" });
  }

  // Fallback / mock extraction if Gemini is not available
  const defaultTitle = fileName ? fileName.split(".")[0] : `Note-${Date.now()}`;
  let fallbackOcr = content || `Processed text note ${defaultTitle}`;
  let fallbackEntities = ["concept", "vault"];
  let fallbackLinks: any[] = [];
  let fallbackColor = "#3b6569";

  if (type === "image") {
    fallbackOcr = "OCR extraction completed. Found drawing guidelines for 'CREVICE WEAVING WARP LAYOUT', 'COASTAL GRANITE LINE GRIDS', and 'ST IVES CORNISH SEAM'.";
    fallbackEntities = ["Tapestry-Grid", "Crevice-Weaving", "Coastal-Erosion", "St-Ives", "Landscape"];
    fallbackLinks = [{ target_node_id: "TAPESTRY-04", reason_for_connection: "Extremely strong 95% thematic and structural overlap to EROSION_MAP_V2 drawing grid blueprints." }];
    fallbackColor = "#beeaef";
  } else if (type === "audio") {
    fallbackOcr = "Audio transcription: 'We harvested fresh bladderwrack kelp along the St Ives coastline to formulate our organic dyes. Testing showed excellent moss-green color fastness when combined with high-salinity mordant baths on raw British Herdwick fleece.'";
    fallbackEntities = ["Bladderwrack-Kelp", "Natural-Dyes", "Herdwick-Wool", "St-Ives", "Organic-Mordant"];
    fallbackLinks = [
      { target_node_id: "TAPESTRY-04", reason_for_connection: "Supplies the biological kelp seaweed dye process to pigment Herdwick wool yarn mapped in the Erosion blueprint." },
      { target_node_id: "WORKSHOP-LOG", reason_for_connection: "Details raw organic mordant chemical compounds presented at the Cornwall Crafts Symposium." }
    ];
    fallbackColor = "#714f94";
  } else if (type === "text" && content) {
    // Basic extraction
    const lowercase = content.toLowerCase();
    fallbackEntities = [];
    if (lowercase.includes("weaving") || lowercase.includes("textile") || lowercase.includes("tapestry") || lowercase.includes("warp") || lowercase.includes("linen")) {
      fallbackEntities.push("Weaving", "Textiles");
      fallbackLinks.push({ target_node_id: "ISABELLE-MAIN", reason_for_connection: "Mentions creative textiles and weaving elements aligning with Isabelle More's artistic profile." });
    }
    if (lowercase.includes("dye") || lowercase.includes("kelp") || lowercase.includes("wool") || lowercase.includes("seaweed")) {
      fallbackEntities.push("Natural-Dyeing", "Wool");
      fallbackLinks.push({ target_node_id: "AUD-WOOL", reason_for_connection: "Refers to seaweed dyeworks and Herdwick wool yarn compounding matches." });
    }
    if (fallbackEntities.length === 0) {
      fallbackEntities = ["Artist Notes", "Conceptual"];
    }
    fallbackColor = "#ffd8ea";
  }

  if (!ai) {
    // Return simulated response when Gemini client is not configured
    return res.json({
      raw_transcription_or_ocr: fallbackOcr,
      extracted_entities: fallbackEntities,
      suggested_node_links: fallbackLinks,
      suggested_title: defaultTitle,
      suggested_color: fallbackColor
    });
  }

  try {
    const activeSub = getActiveSubject(req);
    // Construct the context of the existing nodes vault
    const vaultContext = activeSub.nodes.map(n => ({
      id: n.id,
      title: n.title,
      type: n.type,
      tags: n.tags,
      content: n.content
    }));

    const systemInstruction = `You are the central extraction and semantic relationship engine for a "Second Brain" knowledge management application.
Your role is to process incoming media payloads, extract entities, structure metadata, and define relationships to populate a knowledge graph.
Analyze the input carefully:
1. When an IMAGE is provided: Perform OCR, describe the visual elements, key themes, objects, and text meanings.
2. When AUDIO/VOICE content is provided: Transcribe verbatim, extract primary concepts, actionable items, or core theories discussed.
3. When a TEXT NOTE is provided: Parse for key entities (locations, names, dates, distinct terms).

Compare the input against this existing Node Vault:
${JSON.stringify(vaultContext, null, 2)}

Provide suggested node links if there are shared categories, overlapping context, or temporal connections.
Return your response STRICTLY as a valid JSON object matching the requested schema.`;

    // Define the schema for response verification
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        raw_transcription_or_ocr: {
          type: Type.STRING,
          description: "Transcription or OCR of the uploaded content, detailed analysis."
        },
        extracted_entities: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Extracted concepts, names, locations, topics."
        },
        suggested_node_links: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              target_node_id: { type: Type.STRING, description: "ID of the target node from vault" },
              reason_for_connection: { type: Type.STRING, description: "Explain why this links" }
            },
            required: ["target_node_id", "reason_for_connection"]
          }
        },
        suggested_title: {
          type: Type.STRING,
          description: "Descriptive name for the new node"
        },
        suggested_color: {
          type: Type.STRING,
          description: "Core color hex choice: '#3b6569', '#714f94', '#beeaef', '#ffd8ea', '#e5e2e1'"
        }
      },
      required: ["raw_transcription_or_ocr", "extracted_entities", "suggested_node_links", "suggested_title", "suggested_color"]
    };

    let contents: any;

    if (type === "image" && base64Data) {
      contents = {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || "image/png",
              data: base64Data
            }
          },
          { text: `Analyze this image. Transcribe text labels (OCR) and determine its structural meaning. File name: ${fileName || "unnamed.png"}` }
        ]
      };
    } else if (type === "audio" && base64Data) {
      // Audio processing
      contents = {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || "audio/wav",
              data: base64Data
            }
          },
          { text: `Transcribe this voice memo verbatim. Identify the main concepts discussed and actionable items. File name: ${fileName || "unnamed.wav"}` }
        ]
      };
    } else {
      // Text content
      contents = `Process this raw text content. Extract its meaning, core entities, and connect it with our vault.
File Name: ${fileName || "unnamed.txt"}
Content:
${content || fallbackOcr}`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema
      }
    });

    const result = JSON.parse(response.text.trim());
    res.json(result);

  } catch (error: any) {
    console.error("Gemini processing error:", error);
    // Graceful fallback to avoid breaking the application
    res.json({
      raw_transcription_or_ocr: fallbackOcr + ` [Gemini processing failed: ${error.message}]`,
      extracted_entities: fallbackEntities,
      suggested_node_links: fallbackLinks,
      suggested_title: defaultTitle,
      suggested_color: fallbackColor
    });
  }
});

// Chat Interface / Semantic Search
app.post("/api/chat", async (req, res) => {
  const { message, chatHistory } = req.body;
  const activeSub = getActiveSubject(req);

  if (!message) {
    return res.status(400).json({ error: "Missing message query" });
  }

  // Pre-calculate fallback match logic
  const query = message.toLowerCase();
  let fallbackReply = `I've analyzed your second brain subject workspace. No exact match was found for your specific query, but I see you have ${activeSub.nodes.length} nodes in your active vault. Can you provide more details?`;
  let fallbackCitations: any[] = [];
  let fallbackHighlight: string | undefined = undefined;

  // Let's implement real local semantic search matching keywords as a beautiful fallback!
  const matchedNodes = activeSub.nodes.filter(n => {
    return n.title.toLowerCase().includes(query) ||
           n.content.toLowerCase().includes(query) ||
           n.tags.some(t => t.toLowerCase().includes(query)) ||
           (n.linkDescription && n.linkDescription.toLowerCase().includes(query));
  });

  if (matchedNodes.length > 0) {
    const primary = matchedNodes[0];
    fallbackReply = `I located the node **${primary.title}** which appears closely relevant to your request. ${primary.content}`;
    if (primary.linkDescription) {
      fallbackReply += ` It was saved with the note: "${primary.linkDescription}"`;
    }
    fallbackHighlight = primary.id;
    fallbackCitations = matchedNodes.map(n => ({
      id: n.id,
      title: n.title,
      type: n.type
    }));
  }

  // Handle specific symposium question or tuesday list
  if (query.includes("symposium") || query.includes("notes") || query.includes("cornish") || query.includes("guild")) {
    const symposiumNode = activeSub.nodes.find(n => n.id === "WORKSHOP-LOG");
    if (symposiumNode) {
      fallbackReply = `I found your notes from the **Cornwall Crafts Guild Symposium** (**CORNISH_SYMPOSIUM_LOG.txt**). This log details tactile relief weaving and copper wire stabilization, which links back to **Isabelle's artist profile** to reinforce high-density tapestry structures.`;
      fallbackHighlight = "WORKSHOP-LOG";
      fallbackCitations = [
        { id: "WORKSHOP-LOG", title: "CORNISH_SYMPOSIUM_LOG.txt", type: "text" },
        { id: "ISABELLE-MAIN", title: "ISABELLE_BIO.txt", type: "text" }
      ];
    }
  } else if (query.includes("audio") || query.includes("voice") || query.includes("dye") || query.includes("seaweed") || query.includes("wool")) {
    const audioNode = activeSub.nodes.find(n => n.id === "AUD-WOOL");
    if (audioNode) {
      fallbackReply = `The soundscape recording **WEAVING_SOUNDSCAPE_01.wav** details the St Ives bladderwrack kelp dye formulations used on raw Herdwick sheep wool to achieve organic moss-greens and deep mineral-grays.`;
      fallbackHighlight = "AUD-WOOL";
      fallbackCitations = [{ id: "AUD-WOOL", title: "WEAVING_SOUNDSCAPE_01.wav", type: "audio" }];
    }
  }

  if (!ai) {
    return res.json({
      reply: fallbackReply,
      citations: fallbackCitations,
      highlightedNodeId: fallbackHighlight
    });
  }

  try {
    const vaultContext = activeSub.nodes.map(n => ({
      id: n.id,
      title: n.title,
      type: n.type,
      tags: n.tags,
      content: n.content,
      linkDescription: n.linkDescription,
      createdAt: n.createdAt
    }));

    const systemInstruction = `You are the central Semantic Search and QA Engine for Ciara's "Second Brain" knowledge vault.
Your primary role is to answer questions based strictly on the nodes inside her database.
When Ciara asks about past notes or connections:
1. Locate the exact node matches.
2. Return a brief 2-sentence summary of why it exists and what it discusses.
3. Identify the singular most important Node ID in the 'highlightedNodeId' field so the interface can anchor/scroll to it.
4. Output all relevant node citations in the 'citations' array.

Here is the current vault state:
${JSON.stringify(vaultContext, null, 2)}

Here are the existing links between nodes:
${JSON.stringify(activeSub.links, null, 2)}

Return your answer strictly in JSON format according to the requested schema.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        reply: {
          type: Type.STRING,
          description: "Natural language response summarizing the nodes and answering the question. Include markdown bold styling on node names."
        },
        citations: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              type: { type: Type.STRING, description: "'image', 'audio', or 'text'" }
            },
            required: ["id", "title", "type"]
          }
        },
        highlightedNodeId: {
          type: Type.STRING,
          description: "The primary Node ID to focus/scroll to on the interface, or null if none."
        }
      },
      required: ["reply", "citations"]
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: message,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema
      }
    });

    const result = JSON.parse(response.text.trim());
    res.json(result);

  } catch (error: any) {
    console.error("Gemini chat error:", error);
    res.json({
      reply: fallbackReply + ` [Semantic search fallback active: ${error.message}]`,
      citations: fallbackCitations,
      highlightedNodeId: fallbackHighlight
    });
  }
});

// Vite Middleware & production static asset serving setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Vite dev server integrating in middleware mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Second Brain backend server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
