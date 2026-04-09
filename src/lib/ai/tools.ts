export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, unknown>
      required?: Array<string>
    }
  }
}

export const TOOL_DEFINITIONS: Array<ToolDefinition> = [
  // ── UI Tools (mutate explorer state) ──

  {
    type: 'function',
    function: {
      name: 'set_filters',
      description:
        'Set explorer filters. Only include filters you want to change. Omit filters you want to leave as-is.',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description:
              'Free-text search (matches name, department, research interests)',
          },
          school: {
            type: 'string',
            description: 'School name or "all" for no filter',
          },
          department: {
            type: 'string',
            description: 'Department name or "all" for no filter',
          },
          tier: {
            type: 'string',
            enum: [
              'all',
              'top_1%',
              'top_5%',
              'top_10%',
              'top_25%',
              'above_median',
            ],
            description:
              'Minimum field tier threshold. "top_5%" means top 5% or better.',
          },
          metricSource: {
            type: 'string',
            enum: ['scholar', 'openalex'],
            description: 'Which data source to use for h-index and citations',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_scatter',
      description:
        'Configure the scatter chart axes and encodings. Only include fields you want to change.',
      parameters: {
        type: 'object',
        properties: {
          x: {
            type: 'string',
            enum: [
              'works',
              'citations',
              'hIndex',
              'mIndex',
              'i10',
              'fwci',
              'fieldPct',
              'subfieldPct',
              'deptHPct',
              'deptFwciPct',
              'careerLength',
              'lastYear',
            ],
            description: 'X-axis metric',
          },
          y: {
            type: 'string',
            enum: [
              'works',
              'citations',
              'hIndex',
              'mIndex',
              'i10',
              'fwci',
              'fieldPct',
              'subfieldPct',
              'deptHPct',
              'deptFwciPct',
              'careerLength',
              'lastYear',
            ],
            description: 'Y-axis metric',
          },
          color: {
            type: 'string',
            enum: ['none', 'domain', 'school', 'tier', 'adminRole'],
            description: 'Color encoding categorical field, or "none"',
          },
          size: {
            type: 'string',
            enum: [
              'fixed',
              'works',
              'citations',
              'hIndex',
              'mIndex',
              'i10',
              'fwci',
              'fieldPct',
              'subfieldPct',
              'deptHPct',
              'deptFwciPct',
              'careerLength',
              'lastYear',
            ],
            description: 'Size encoding metric, or "fixed" for uniform size',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clear_filters',
      description: 'Reset all explorer filters to their defaults.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },

  // ── Data Retrieval Tools (resolved client-side) ──

  {
    type: 'function',
    function: {
      name: 'get_dataset_summary',
      description:
        'Get high-level stats about the full faculty dataset: total faculty, coverage by source, school breakdown, median h-index. Call this first for general questions.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_faculty_detail',
      description:
        'Get the full profile for a specific faculty member by name. Uses fuzzy matching.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Faculty member name (e.g. "Jerome Katz")',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_school_summary',
      description:
        'Get summary stats for a specific school: faculty count, coverage, median h-index, top faculty, department breakdown.',
      parameters: {
        type: 'object',
        properties: {
          school: {
            type: 'string',
            description: 'School name (e.g. "Chaifetz School of Business")',
          },
        },
        required: ['school'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_department_summary',
      description:
        'Get summary stats for a specific department: faculty count, coverage, median h-index, top faculty.',
      parameters: {
        type: 'object',
        properties: {
          department: {
            type: 'string',
            description: 'Department name (e.g. "Finance")',
          },
        },
        required: ['department'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_rankings',
      description:
        'Rank faculty by a metric. Returns top or bottom faculty with values.',
      parameters: {
        type: 'object',
        properties: {
          metric: {
            type: 'string',
            enum: [
              'hIndex',
              'mIndex',
              'citations',
              'works',
              'fwci',
              'fieldPercentile',
            ],
            description: 'Metric to rank by',
          },
          school: {
            type: 'string',
            description: 'Optional school filter',
          },
          department: {
            type: 'string',
            description: 'Optional department filter',
          },
          order: {
            type: 'string',
            enum: ['desc', 'asc'],
            description: 'Sort order (default: desc = highest first)',
          },
          limit: {
            type: 'number',
            description: 'Number of results (default: 10, max: 25)',
          },
        },
        required: ['metric'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_faculty',
      description:
        'Search faculty by name, department, research interests, or OpenAlex field. Returns matching faculty with key metrics.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Search query (matched against name, department, research interests, OpenAlex field/topic)',
          },
          limit: {
            type: 'number',
            description: 'Max results (default: 10, max: 25)',
          },
        },
        required: ['query'],
      },
    },
  },
]

export const DATA_TOOL_NAMES = new Set([
  'get_dataset_summary',
  'get_faculty_detail',
  'get_school_summary',
  'get_department_summary',
  'get_rankings',
  'search_faculty',
])
