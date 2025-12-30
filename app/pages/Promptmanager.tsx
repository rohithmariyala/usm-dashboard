"use client";

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  History,
  FileText,
  Save,
  Loader2,
  Tag,
  Calendar,
  User,
  GitBranch,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Import types/helpers
import {
  PromptVersion,
  PromptFormData,
  PromptFilterState,
  Environment,
  getUniqueFlows,
  getFeaturesByFlow,
  getTypesByFlowFeatureMode,
  USER_STORY_TYPES,
  COMMON_PROMPT_TYPES,
  normalizePromptId,
} from "./types";

// Monaco Editor (lazy loaded, client-side only)
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

interface PromptManagerProps {
  environment: Environment;
}

// Backend API base URL
const API_BASE_URL = "http://localhost:8000/backend/userstory_prompts";

// Mode options used in the Mode dropdown (base predefined list)
const MODE_OPTIONS: PromptFormData["mode"][] = [
  "CRA",
  "Userstory",
  "MMVF",
  "Stormee-normal",
  "Stormee-Cra",
];

interface PromptViewerState {
  promptId: string;
  title?: string;
  version?: number;
  mode?: string;
  flow?: string;
  description?: string;
  content: string;
}

/**
 * Helper to determine if any filter is active.
 *
 * NOTE: "search" is also treated as a filter flag.
 */
const hasAnyActiveFilter = (filters: PromptFilterState): boolean => {
  return Boolean(
    (filters.search && filters.search.trim().length > 0) ||
      filters.flow ||
      filters.promptTitle ||
      filters.mode ||
      (filters.promptDescription &&
        filters.promptDescription.trim().length > 0)
  );
};

/**
 * Helper to get a normalized prompt description filter (lowercased).
 */
const getNormalizedPromptDescriptionFilter = (
  promptDescription?: string
): string | undefined => {
  if (!promptDescription) return undefined;
  const trimmed = promptDescription.trim();
  if (!trimmed) return undefined;
  return trimmed.toLowerCase();
};

/**
 * Helper to build a search string from PromptVersion fields.
 */
const buildSearchableStringFromPrompt = (prompt: PromptVersion): string => {
  const parts: string[] = [];

  if (prompt.promptId) parts.push(String(prompt.promptId));
  if (prompt.flow) parts.push(String(prompt.flow));
  if (prompt.promptTitle) parts.push(String(prompt.promptTitle));
  if (prompt.mode) parts.push(String(prompt.mode));
  if (prompt.promptDescription) parts.push(String(prompt.promptDescription));
  if (prompt.prompt) parts.push(String(prompt.prompt));

  if (prompt.metadata) {
    if (prompt.metadata.author) parts.push(String(prompt.metadata.author));
    if (prompt.metadata.changelog)
      parts.push(String(prompt.metadata.changelog));
  }

  return parts.join(" ").toLowerCase();
};

/**
 * Helper that takes ALL prompt versions and:
 * - If NO filter is active → returns the latest version per promptId.
 * - If at least one filter is active → returns ALL versions that match.
 */
const computeVisiblePrompts = (
  allPrompts: PromptVersion[],
  filters: PromptFilterState
): PromptVersion[] => {
  const searchLower = filters.search?.toLowerCase().trim() ?? "";
  const hasSearch = searchLower.length > 0;

  // Normalize promptDescription filter for substring matches.
  const normalizedPromptDescriptionFilter =
    getNormalizedPromptDescriptionFilter(filters.promptDescription);

  // First, filter by flow/promptTitle/mode/promptDescription/search.
  const filtered = allPrompts.filter((prompt) => {
    // Flow filter (exact match)
    if (filters.flow && prompt.flow !== filters.flow) {
      return false;
    }

    // PromptTitle filter (exact match)
    if (filters.promptTitle && prompt.promptTitle !== filters.promptTitle) {
      return false;
    }

    // Mode filter (exact match)
    if (filters.mode && prompt.mode !== filters.mode) {
      return false;
    }

    // PromptDescription filter (substring, case-insensitive)
    if (normalizedPromptDescriptionFilter) {
      const pd = (prompt.promptDescription || "").toLowerCase();
      if (!pd.includes(normalizedPromptDescriptionFilter)) {
        return false;
      }
    }

    // Search filter: OR across multiple fields
    if (!hasSearch) {
      return true;
    }

    const searchable = buildSearchableStringFromPrompt(prompt);
    return searchable.includes(searchLower);
  });

  // If no filters at all → we only want ONE record per promptId: the latest version.
  const anyFilter = hasAnyActiveFilter(filters);

  if (!anyFilter) {
    // Group by promptId and pick the latest version.
    const latestByPromptId = new Map<string, PromptVersion>();

    for (const p of filtered) {
      const key = p.promptId;
      if (!key) continue;

      const existing = latestByPromptId.get(key);
      if (!existing) {
        latestByPromptId.set(key, p);
        continue;
      }

      const currentVersion = typeof p.version === "number" ? p.version : 0;
      const existingVersion =
        typeof existing.version === "number" ? existing.version : 0;

      if (currentVersion > existingVersion) {
        latestByPromptId.set(key, p);
      }
    }

    const deduped = Array.from(latestByPromptId.values());

    // Sort latest versions – you can tweak this sort logic as needed.
    deduped.sort((a, b) => {
      const av = typeof a.version === "number" ? a.version : 0;
      const bv = typeof b.version === "number" ? b.version : 0;

      // Descending by version number
      if (bv !== av) {
        return bv - av;
      }

      // Fallback: alphabetical by promptTitle
      return (a.promptTitle || "").localeCompare(b.promptTitle || "");
    });

    return deduped;
  }

  // If there IS any filter, we show ALL matching versions (no dedup by promptId).
  // Sort descending by version, then by promptTitle.
  const filteredSorted = [...filtered].sort((a, b) => {
    const av = typeof a.version === "number" ? a.version : 0;
    const bv = typeof b.version === "number" ? b.version : 0;

    if (bv !== av) {
      return bv - av;
    }

    return (a.promptTitle || "").localeCompare(b.promptTitle || "");
  });

  return filteredSorted;
};

/**
 * Helper to compute unique modes (predefined + any custom ones found in data).
 */
const computeAvailableModes = (
  prompts: PromptVersion[],
  baseModes: string[]
): string[] => {
  const modesFromPrompts = prompts
    .map((p) => p.mode)
    .filter((m) => !!m) as string[];
  return Array.from(new Set<string>([...(baseModes || []), ...modesFromPrompts]));
};

/**
 * Helper to compute mode badge classes.
 */
const getModeBadgeClassName = (mode?: string): string => {
  if (!mode) return "border-slate-500 text-slate-300";

  if (mode === "Stormee-normal" || mode === "Stormee-Cra") {
    return "border-purple-500 text-purple-400";
  }

  return "border-green-500 text-green-400";
};

export default function PromptManager({ environment }: PromptManagerProps) {
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptVersion | null>(
    null
  );
  const [viewingVersions, setViewingVersions] = useState<string | null>(null);
  const [versions, setVersions] = useState<PromptVersion[]>([]);

  // Prompt Viewer (Monaco) state
  const [isPromptViewerOpen, setIsPromptViewerOpen] = useState(false);
  const [promptViewerData, setPromptViewerData] =
    useState<PromptViewerState | null>(null);

  // Dynamic flow/promptTitle/mode data
  const [availableFlows, setAvailableFlows] = useState<string[]>([]);
  const [availablePromptTitles, setAvailablePromptTitles] = useState<string[]>(
    []
  );
  const [availablePromptDescriptions, setAvailablePromptDescriptions] =
    useState<string[]>([]);
  const [availableModes, setAvailableModes] =
    useState<string[]>(MODE_OPTIONS); // dynamic modes (predefined + custom)

  // Form state
  const [formData, setFormData] = useState<PromptFormData>({
    promptId: "",
    flow: "",
    promptTitle: "",
    mode: "Userstory",
    promptDescription: "",
    prompt: "",
    metadata: {
      author: "",
      changelog: "",
      tokens: 0,
    },
  });

  // Filter state
  const [filters, setFilters] = useState<PromptFilterState>({});

  // ======================================
  // Helper: open prompt content in Monaco editor
  // ======================================
  const openPromptInEditor = (prompt: PromptVersion) => {
    setPromptViewerData({
      promptId: prompt.promptId,
      title: prompt.promptTitle,
      version: prompt.version,
      mode: prompt.mode,
      flow: prompt.flow,
      description: prompt.promptDescription,
      content: prompt.prompt,
    });
    setIsPromptViewerOpen(true);
  };

  // ======================================
  // Load prompts and extract dynamic structure
  // ======================================
  const loadPrompts = async () => {
    setLoading(true);
    setError(null);

    try {
      const url = `${API_BASE_URL}/prompt-version`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load prompts: ${response.status}`);
      }

      const result = await response.json();

      let promptsData: PromptVersion[] = [];
      if (Array.isArray(result)) {
        promptsData = result;
      } else if (result.data && Array.isArray(result.data)) {
        promptsData = result.data;
      } else if (result.message === "Prompt not found") {
        promptsData = [];
      } else {
        promptsData = [result];
      }

      setPrompts(promptsData);

      // Flows for dropdowns
      setAvailableFlows(getUniqueFlows(promptsData));

      // Build dynamic modes list (predefined + custom from DB)
      setAvailableModes(computeAvailableModes(promptsData, MODE_OPTIONS));
    } catch (err) {
      console.error("Error loading prompts:", err);
      setError(err instanceof Error ? err.message : "Failed to load prompts");
      setPrompts([]);
      // Keep availableModes as is if loading fails
    } finally {
      setLoading(false);
    }
  };

  // ======================================
  // Load versions for a specific promptId
  // ======================================
  const loadVersions = async (promptId: string) => {
    try {
      const versionsData = prompts
        .filter((p) => p.promptId === promptId)
        .sort((a, b) => {
          const av = typeof a.version === "number" ? a.version : 0;
          const bv = typeof b.version === "number" ? b.version : 0;
          return bv - av;
        });

      setVersions(versionsData);
      setViewingVersions(promptId);
    } catch (err) {
      console.error("Error loading versions:", err);
      setError(err instanceof Error ? err.message : "Failed to load versions");
    }
  };

  // ======================================
  // Update available promptTitles when flow changes
  // ======================================
  useEffect(() => {
    if (formData.flow && prompts.length > 0) {
      const promptTitles = getFeaturesByFlow(prompts, formData.flow);
      setAvailablePromptTitles(promptTitles);
      if (
        formData.promptTitle &&
        !promptTitles.includes(formData.promptTitle) &&
        promptTitles.length > 0
      ) {
        setFormData((prev) => ({
          ...prev,
          promptTitle: "",
          promptDescription: "",
        }));
      }
    } else {
      setAvailablePromptTitles([]);
    }
  }, [formData.flow, prompts]);

  // ======================================
  // Load prompts on component mount or when environment changes
  // (NOT when filters change – we filter client-side)
  // ======================================
  useEffect(() => {
    loadPrompts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [environment]);

  // ======================================
  // Handle form submission
  // ======================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (
        !formData.flow.trim() ||
        !formData.promptTitle.trim() ||
        !formData.promptDescription.trim() ||
        !formData.prompt.trim()
      ) {
        throw new Error("Please fill in all required fields");
      }

      // Base payload for backend
      const payload: any = {
        flow: formData.flow,
        promptTitle: formData.promptTitle,
        mode: formData.mode,
        promptDescription: formData.promptDescription,
        prompt: formData.prompt,
        metadata: {
          author: formData.metadata.author || "",
          changelog: formData.metadata.changelog || "",
          tokens: formData.metadata.tokens || 0,
        },
      };

      // For EDIT (PUT): we MUST send the existing promptId so backend versions correctly
      if (isEditing && formData.promptId) {
        payload.promptId = formData.promptId;
      }

      const method = isEditing ? "PUT" : "POST";
      const response = await fetch(`${API_BASE_URL}/prompt-version`, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // Try to parse JSON (even on non-2xx so we can read `exists`)
      let result: any = null;
      try {
        result = await response.json();
      } catch (parseErr) {
        // ignore parse error; result stays null
      }

      // Handle the "record already exists" case regardless of status code
      if (!isEditing && result && result.exists) {
        alert(
          result.message ||
            "Record already exists with this flow, mode, and promptTitle combination"
        );
        // Don't close the dialog – let user adjust values
        return;
      }

      // If response is not ok and not a handled "exists" case, throw error
      if (!response.ok) {
        throw new Error(
          (result && (result.error || result.detail || result.message)) ||
            "Failed to save prompt"
        );
      }

      // Normal success path
      setFormData({
        promptId: "",
        flow: "",
        promptTitle: "",
        mode: "Userstory",
        promptDescription: "",
        prompt: "",
        metadata: { author: "", changelog: "", tokens: 0 },
      });
      setIsDialogOpen(false);
      setIsEditing(false);
      setEditingPrompt(null);
      await loadPrompts();
      setError(null);
    } catch (err) {
      console.error("Error saving prompt:", err);
      setError(err instanceof Error ? err.message : "Failed to save prompt");
    }
  };

  // ======================================
  // Handle edit
  // ======================================
  const handleEdit = (prompt: PromptVersion) => {
    setFormData({
      promptId: prompt.promptId,
      flow: prompt.flow,
      promptTitle: prompt.promptTitle,
      mode: prompt.mode,
      promptDescription: prompt.promptDescription,
      prompt: prompt.prompt,
      metadata: prompt.metadata,
    });
    setEditingPrompt(prompt);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  // ======================================
  // Handle delete
  // ======================================
  const handleDelete = async (promptId: string, version: number) => {
    if (!confirm("Are you sure you want to delete this prompt version?")) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/prompt-version?promptId=${promptId}&version=${version}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete prompt");
      }

      await loadPrompts();
      if (viewingVersions === promptId) {
        await loadVersions(promptId);
      }
    } catch (err) {
      console.error("Error deleting prompt:", err);
      setError(err instanceof Error ? err.message : "Failed to delete prompt");
    }
  };

  // ======================================
  // Compute filtered + deduped prompts (latest-only vs all versions)
  // ======================================
  const filteredPrompts: PromptVersion[] = useMemo(
    () => computeVisiblePrompts(prompts, filters),
    [prompts, filters]
  );

  // ======================================
  // JSX
  // ======================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Prompt Management</h2>
          <p className="text-slate-400">
            Manage and version your AI prompts across flows, titles, and modes
          </p>
          <p className="text-slate-500 text-sm mt-1">
            Backend: {API_BASE_URL}/prompt-version
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                setIsEditing(false);
                setEditingPrompt(null);
                setFormData({
                  promptId: "",
                  flow: "",
                  promptTitle: "",
                  mode: "Userstory",
                  promptDescription: "",
                  prompt: "",
                  metadata: { author: "", changelog: "", tokens: 0 },
                });
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Prompt
            </Button>
          </DialogTrigger>

          <DialogContent className="bg-slate-800 border-slate-700 max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white">
                {isEditing
                  ? "Update Prompt (Create New Version)"
                  : "Create New Prompt"}
              </DialogTitle>
            </DialogHeader>

            {/* FORM */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Flow - Allow free text input for new flows */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">Flow *</label>
                  <div className="space-y-2">
                    {availableFlows.length > 0 && (
                      <Select
                        value={
                          availableFlows.includes(formData.flow)
                            ? formData.flow
                            : "none_selected"
                        }
                        onValueChange={(value: string) => {
                          if (value === "custom" || value === "none_selected")
                            return;
                          setFormData((prev) => ({ ...prev, flow: value }));
                        }}
                      >
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                          <SelectValue placeholder="Select existing flow" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600">
                          <SelectItem
                            value="none_selected"
                            className="text-slate-400 italic"
                          >
                            Select existing flow...
                          </SelectItem>
                          {availableFlows.map((flow) => (
                            <SelectItem key={flow} value={flow} className="text-white">
                              {flow.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                          <SelectItem
                            value="custom"
                            className="text-blue-400 font-medium"
                          >
                            + Create New Flow
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <Input
                      value={formData.flow}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, flow: e.target.value }))
                      }
                      placeholder={
                        availableFlows.length > 0
                          ? "Or enter new flow name"
                          : "Enter flow name"
                      }
                      className="bg-slate-700 border-slate-600 text-white"
                      required
                    />
                  </div>
                </div>

                {/* Prompt Title - Allow free text input for new titles */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">
                    Prompt Title *
                  </label>
                  <div className="space-y-2">
                    {availablePromptTitles.length > 0 && (
                      <Select
                        value={
                          availablePromptTitles.includes(formData.promptTitle)
                            ? formData.promptTitle
                            : "none_selected"
                        }
                        onValueChange={(value: string) => {
                          if (value === "custom" || value === "none_selected")
                            return;
                          setFormData((prev) => ({ ...prev, promptTitle: value }));
                        }}
                      >
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                          <SelectValue placeholder="Select existing prompt title" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600">
                          <SelectItem
                            value="none_selected"
                            className="text-slate-400 italic"
                          >
                            Select existing prompt title...
                          </SelectItem>
                          {availablePromptTitles.map((title) => (
                            <SelectItem key={title} value={title} className="text-white">
                              {title.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                          <SelectItem
                            value="custom"
                            className="text-blue-400 font-medium"
                          >
                            + Create New Prompt Title
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <Input
                      value={formData.promptTitle}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          promptTitle: e.target.value,
                        }))
                      }
                      placeholder={
                        availablePromptTitles.length > 0
                          ? "Or enter new prompt title"
                          : "Enter prompt title"
                      }
                      className="bg-slate-700 border-slate-600 text-white"
                      required
                    />
                  </div>
                </div>

                {/* Mode - existing options + custom from DB + free text */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">Mode *</label>
                  <div className="space-y-2">
                    <Select
                      value={
                        availableModes.includes(formData.mode as string)
                          ? formData.mode
                          : "none_selected"
                      }
                      onValueChange={(value: string) => {
                        if (value === "custom" || value === "none_selected") return;
                        setFormData((prev) => ({
                          ...prev,
                          mode: value as PromptFormData["mode"],
                        }));
                      }}
                      required
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem
                          value="none_selected"
                          className="text-slate-400 italic"
                        >
                          Select existing mode...
                        </SelectItem>
                        {availableModes.map((mode) => (
                          <SelectItem key={mode} value={mode} className="text-white">
                            {mode}
                          </SelectItem>
                        ))}
                        <SelectItem
                          value="custom"
                          className="text-blue-400 font-medium"
                        >
                          + Create New Mode
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={formData.mode}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          mode: e.target.value as PromptFormData["mode"],
                        }))
                      }
                      placeholder="Or enter new mode"
                      className="bg-slate-700 border-slate-600 text-white"
                      required
                    />
                  </div>
                </div>

                {/* Prompt Description - Free text only */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">
                    Prompt Description *
                  </label>
                  <Textarea
                    value={formData.promptDescription}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        promptDescription: e.target.value,
                      }))
                    }
                    placeholder="Enter prompt description..."
                    required
                    rows={4}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
              </div>

              {/* Prompt ID - ONLY in edit mode, read-only */}
              {isEditing && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">Prompt ID</label>
                  <Input
                    value={formData.promptId}
                    readOnly
                    disabled
                    className="bg-slate-800 border-slate-600 text-slate-300 cursor-not-allowed"
                  />
                </div>
              )}

              {/* Prompt Content */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">
                  Prompt Content *
                </label>
                <Textarea
                  value={formData.prompt}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, prompt: e.target.value }))
                  }
                  placeholder="Enter your prompt content..."
                  required
                  rows={8}
                  className="bg-slate-700 border-slate-600 text-white max-h-40 overflow-y-auto"
                />
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">Author</label>
                  <Input
                    value={formData.metadata.author || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        metadata: { ...prev.metadata, author: e.target.value },
                      }))
                    }
                    placeholder="Author name"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">
                    Token Count
                  </label>
                  <Input
                    type="number"
                    value={formData.metadata.tokens || 0}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        metadata: {
                          ...prev.metadata,
                          tokens: parseInt(e.target.value) || 0,
                        },
                      }))
                    }
                    placeholder="0"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">Changelog</label>
                  <Input
                    value={formData.metadata.changelog || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        metadata: { ...prev.metadata, changelog: e.target.value },
                      }))
                    }
                    placeholder="What changed in this version?"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isEditing ? "Create New Version" : "Create Prompt"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Search className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Search filter */}
            <Input
              placeholder="Search prompts..."
              value={filters.search || ""}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value }))
              }
              className="bg-slate-700 border-slate-600 text-white"
            />

            {/* Flow filter */}
            <Select
              value={filters.flow || "all_flows"}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  flow: value === "all_flows" ? undefined : value,
                  promptTitle: undefined,
                  promptDescription: undefined,
                }))
              }
            >
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="All flows" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                <SelectItem value="all_flows" className="text-white">
                  All flows
                </SelectItem>
                {availableFlows.map((flow) => (
                  <SelectItem key={flow} value={flow} className="text-white">
                    {flow.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* PromptTitle filter */}
            <Select
              value={filters.promptTitle || "all_promptTitles"}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  promptTitle: value === "all_promptTitles" ? undefined : value,
                  promptDescription: undefined,
                }))
              }
              disabled={!filters.flow}
            >
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="All prompt titles" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                <SelectItem value="all_promptTitles" className="text-white">
                  All prompt titles
                </SelectItem>
                {filters.flow &&
                  getFeaturesByFlow(prompts, filters.flow).map((title) => (
                    <SelectItem key={title} value={title} className="text-white">
                      {title.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            {/* Mode filter – uses dynamic availableModes */}
            <Select
              value={filters.mode || "all_modes"}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  mode:
                    value === "all_modes"
                      ? undefined
                      : (value as PromptFormData["mode"]),
                }))
              }
            >
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="All modes" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                <SelectItem value="all_modes" className="text-white">
                  All modes
                </SelectItem>
                {availableModes.map((mode) => (
                  <SelectItem key={mode} value={mode} className="text-white">
                    {mode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* PromptDescription filter */}
            <Input
              placeholder="Filter by prompt description..."
              value={filters.promptDescription || ""}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  promptDescription: e.target.value,
                }))
              }
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="bg-red-900/20 border-red-600">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <p className="text-red-400">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-400" />
          <p className="text-slate-400">Loading prompts...</p>
        </div>
      )}

      {/* Prompts List */}
      {!loading && (
        <div className="grid gap-6">
          {filteredPrompts.length === 0 ? (
            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                <p className="text-slate-400 text-lg">No prompts found</p>
                <p className="text-slate-500 text-sm">
                  {Object.keys(filters).some(
                    (key) => (filters as any)[key as keyof PromptFilterState]
                  )
                    ? "Try adjusting your filters or create a new prompt"
                    : "Create your first prompt to get started"}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredPrompts.map((prompt) => (
              <Card
                key={`${prompt.promptId}-${prompt.version}`}
                className="bg-slate-800/50 backdrop-blur-sm border-slate-700"
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {/* Title shows promptTitle instead of promptId */}
                        <CardTitle className="text-white">
                          {prompt.promptTitle}
                        </CardTitle>
                        <Badge
                          variant="secondary"
                          className="bg-blue-600 text-white"
                        >
                          v{prompt.version}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={getModeBadgeClassName(prompt.mode)}
                        >
                          {prompt.mode}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm text-slate-400">
                        <span className="flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          {prompt.flow}
                        </span>
                        <span>→</span>
                        <span>{prompt.promptTitle}</span>
                        <span>→</span>
                        <span>{prompt.promptDescription}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadVersions(prompt.promptId)}
                        className="border-slate-600 text-slate-300 hover:bg-slate-700"
                      >
                        <History className="mr-1 h-3 w-3" />
                        Versions
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(prompt)}
                        className="border-slate-600 text-slate-300 hover:bg-slate-700"
                      >
                        <Edit className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleDelete(prompt.promptId, prompt.version)
                        }
                        className="border-red-600 text-red-400 hover:bg-red-900/20"
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-white mb-2">
                      Prompt Content:
                    </h4>
                    <div className="bg-slate-900/50 rounded-lg p-3 max-h-32 overflow-y-auto">
                      <pre className="text-sm text-slate-300 whitespace-pre-wrap">
                        {prompt.prompt.length > 500
                          ? `${prompt.prompt.substring(0, 500)}...`
                          : prompt.prompt}
                      </pre>
                    </div>
                    {prompt.prompt.length > 500 && (
                      <button
                        type="button"
                        onClick={() => openPromptInEditor(prompt)}
                        className="mt-2 text-xs font-medium text-blue-400 hover:text-blue-300 hover:underline"
                      >
                        View full prompt in editor
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {prompt.metadata?.author && (
                      <div className="flex items-center gap-1 text-slate-400">
                        <User className="h-3 w-3" />
                        <span>{prompt.metadata.author}</span>
                      </div>
                    )}
                    {prompt.metadata?.tokens && (
                      <div className="flex items-center gap-1 text-slate-400">
                        <FileText className="h-3 w-3" />
                        <span>{prompt.metadata.tokens} tokens</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-slate-400">
                      <Calendar className="h-3 w-3" />
                      <span>{prompt.metadata?.displayDate}</span>
                    </div>
                    {prompt.metadata?.changelog && (
                      <div className="flex items-center gap-1 text-slate-400">
                        <GitBranch className="h-3 w-3" />
                        <span className="truncate">
                          {prompt.metadata.changelog}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Versions Modal */}
      {viewingVersions && (
        <Dialog
          open={!!viewingVersions}
          onOpenChange={(open) => {
            if (!open) setViewingVersions(null);
          }}
        >
          <DialogContent className="bg-slate-800 border-slate-700 max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <History className="h-4 w-4" />
                Version History: {viewingVersions}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 relative pl-6 border-l border-slate-700">
              {versions.map((version) => (
                <div
                  key={`${version.promptId}-${version.version}`}
                  className="relative bg-slate-700/40 border border-slate-600 rounded-xl p-5 shadow-lg"
                >
                  {/* Timeline dot */}
                  <div className="absolute -left-3 top-6 h-4 w-4 rounded-full bg-blue-500 shadow-md"></div>

                  {/* Header */}
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="secondary"
                        className="bg-blue-600 text-white px-3 py-1 text-sm rounded-md"
                      >
                        v{version.version}
                      </Badge>

                      <span className="text-xs text-slate-400">
                        {version.metadata?.displayDate} ·{" "}
                        {version.metadata?.displayTime}
                      </span>

                      {version.metadata?.author && (
                        <span className="text-xs text-slate-400">
                          by {version.metadata.author}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setViewingVersions(null);
                          handleEdit(version);
                        }}
                        className="border-slate-500 text-slate-300 hover:bg-slate-600/60"
                      >
                        <Edit className="mr-1 h-3 w-3" />
                        Use Template
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleDelete(version.promptId, version.version)
                        }
                        className="border-red-600 text-red-400 hover:bg-red-900/20"
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  {/* Changelog */}
                  {version.metadata?.changelog && (
                    <p className="text-sm text-blue-300 italic mb-3">
                      ✨ {version.metadata.changelog}
                    </p>
                  )}

                  {/* Prompt Content Preview */}
                  <div className="bg-slate-900/50 rounded-lg p-4 text-sm max-h-48 overflow-y-auto border border-slate-700/50">
                    <pre className="text-slate-300 whitespace-pre-wrap">
                      {version.prompt.length > 600
                        ? `${version.prompt.substring(0, 600)}...`
                        : version.prompt}
                    </pre>
                  </div>
                  {version.prompt.length > 600 && (
                    <button
                      type="button"
                      onClick={() => openPromptInEditor(version)}
                      className="mt-2 text-xs font-medium text-blue-400 hover:text-blue-300 hover:underline"
                    >
                      View full prompt in editor
                    </button>
                  )}
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Prompt Viewer (Monaco Editor) */}
      {promptViewerData && (
        <Dialog open={isPromptViewerOpen} onOpenChange={setIsPromptViewerOpen}>
          <DialogContent className="bg-slate-900 border-slate-700 max-w-5xl w-full h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-white flex flex-wrap items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>
                  {promptViewerData.title || "Prompt"}{" "}
                  {typeof promptViewerData.version === "number"
                    ? `(v${promptViewerData.version})`
                    : ""}
                </span>
                {promptViewerData.mode && (
                  <Badge
                    variant="outline"
                    className={getModeBadgeClassName(promptViewerData.mode)}
                  >
                    {promptViewerData.mode}
                  </Badge>
                )}
                {promptViewerData.flow && (
                  <Badge variant="secondary" className="bg-slate-700 text-slate-100">
                    {promptViewerData.flow}
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>

            {promptViewerData.description && (
              <p className="text-xs text-slate-400 mb-2 px-1">
                {promptViewerData.description}
              </p>
            )}

            <div className="flex-1 min-h-0 mt-2 rounded-lg overflow-hidden border border-slate-700/70">
              <MonacoEditor
                defaultLanguage="markdown"
                theme="vs-dark"
                value={promptViewerData.content}
                options={{
                  readOnly: true,
                  wordWrap: "on",
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 13,
                  lineNumbers: "on",
                  renderWhitespace: "none",
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
