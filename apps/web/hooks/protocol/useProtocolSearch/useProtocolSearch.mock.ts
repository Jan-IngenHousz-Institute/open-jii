import type { Protocol } from "@repo/api";

/**
 * Mock version of useProtocolSearch hook with hardcoded demo data
 * @param search Search term (controlled externally)
 * @returns Query result containing the protocols list
 */

interface useProtocolSearchResult {
  protocols: Protocol[] | undefined;
  isLoading: boolean;
  error: unknown;
}

// Mock hardcoded protocols for demo
const MOCK_PROTOCOLS: Protocol[] = [
  {
    id: "protocol-photosynthesis-v2",
    name: "Photosynthesis Rate Measurement v2.0",
    family: "Plant Physiology",
    description: "Advanced protocol for measuring photosynthetic efficiency using PAM fluorometry",
    version: "2.0",
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-03-01T14:30:00Z",
    isActive: true,
    tags: ["photosynthesis", "fluorometry", "plant", "efficiency"],
  },
  {
    id: "protocol-soil-analysis",
    name: "Soil Nutrient Analysis",
    family: "Environmental Science",
    description: "Comprehensive soil testing protocol for NPK and micronutrient analysis",
    version: "1.5",
    createdAt: "2024-02-01T09:15:00Z",
    updatedAt: "2024-02-28T16:45:00Z",
    isActive: true,
    tags: ["soil", "nutrients", "NPK", "environmental"],
  },
  {
    id: "protocol-water-quality",
    name: "Water Quality Assessment",
    family: "Environmental Science", 
    description: "Multi-parameter water quality testing including pH, dissolved oxygen, and turbidity",
    version: "1.3",
    createdAt: "2024-01-20T11:30:00Z",
    updatedAt: "2024-02-15T13:20:00Z",
    isActive: true,
    tags: ["water", "quality", "pH", "oxygen", "turbidity"],
  },
  {
    id: "protocol-leaf-morphology",
    name: "Leaf Morphology Analysis",
    family: "Plant Biology",
    description: "Quantitative analysis of leaf shape, size, and structural characteristics",
    version: "2.1",
    createdAt: "2024-01-10T08:45:00Z",
    updatedAt: "2024-03-05T10:15:00Z",
    isActive: true,
    tags: ["morphology", "leaf", "plant", "structure"],
  },
  {
    id: "protocol-spectroscopy-basic",
    name: "Basic Spectroscopy Analysis",
    family: "Analytical Chemistry",
    description: "Fundamental spectroscopic measurements for sample identification",
    version: "1.0",
    createdAt: "2024-02-10T14:00:00Z",
    updatedAt: "2024-02-10T14:00:00Z",
    isActive: true,
    tags: ["spectroscopy", "chemistry", "analysis", "identification"],
  },
  {
    id: "analysis-statistical-summary",
    name: "Statistical Summary Analysis",
    family: "Data Analysis",
    description: "Comprehensive statistical analysis with descriptive statistics and visualizations",
    version: "1.2",
    createdAt: "2024-01-25T12:30:00Z",
    updatedAt: "2024-02-20T15:45:00Z",
    isActive: true,
    tags: ["statistics", "analysis", "summary", "visualization"],
  },
  {
    id: "analysis-correlation-matrix",
    name: "Correlation Matrix Analysis",
    family: "Data Analysis",
    description: "Generate correlation matrices and identify relationships between variables",
    version: "1.1",
    createdAt: "2024-02-05T09:20:00Z",
    updatedAt: "2024-02-25T11:10:00Z",
    isActive: true,
    tags: ["correlation", "matrix", "relationships", "variables"],
  },
];

export const useProtocolSearch = (search = ""): useProtocolSearchResult => {
  // Simulate loading delay
  const isLoading = false;

  // Filter protocols based on search term
  const filteredProtocols = search
    ? MOCK_PROTOCOLS.filter(
        (protocol) =>
          protocol.name.toLowerCase().includes(search.toLowerCase()) ||
          protocol.family.toLowerCase().includes(search.toLowerCase()) ||
          protocol.description.toLowerCase().includes(search.toLowerCase()) ||
          protocol.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()))
      )
    : MOCK_PROTOCOLS;

  return {
    protocols: filteredProtocols,
    isLoading,
    error: null,
  };
};