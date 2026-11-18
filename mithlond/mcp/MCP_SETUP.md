# Norfolk OpenGov MCP Server — Setup

This MCP server gives Gemini CLI direct access to Norfolk's Socrata open data portal.
It resolves the `data.norfolk.gov` PERMISSIONS_ERROR that blocks Claude's environment.

## Install

```bash
cd mcp/
pip install -r requirements.txt
```

## Register with Gemini CLI

### Option A — CLI command
```bash
gemini mcp add norfolk-opengov --command "python3 $(pwd)/norfolk_mcp.py"
```

### Option B — settings.json
Add to `~/.gemini/settings.json` or `.gemini/settings.json` in the project root:

```json
{
  "mcpServers": {
    "norfolk-opengov": {
      "command": "python3",
      "args": ["/absolute/path/to/mithlond/mcp/norfolk_mcp.py"],
      "trust": true
    }
  }
}
```

Note: use an **absolute path** to the script.

## Verify

```
/mcp
```

You should see `norfolk-opengov` with four tools listed.

## Available Tools

| Tool | Dataset | Primary Use |
|------|---------|-------------|
| `norfolk_search_permits` | bnrb-u445 | Building/electrical/mechanical permits — find generator or large service permits |
| `norfolk_search_property` | m5ya-5grb | Property ownership — find Dominion-owned parcels, verify building ownership |
| `norfolk_search_row_permits` | amvm-vkq5 | ROW excavations — track conduit/fiber installation near candidate sites |
| `norfolk_get_dataset_schema` | any | Inspect column names before constructing filters |

## Key Queries for Active Tasks

### A2a — Find Dominion-owned downtown parcels
```
Use norfolk_search_property with owner_name="VIRGINIA ELECTRIC" and zip_code="23510"
Also try zip_code="23517"
Report all matching parcels with address, parcel_id, and assessed_value
```

### X1 — Generator / data center permit monitoring
```
Use norfolk_search_permits with keyword="generator" and issued_after="2023-01-01"
Also try keyword="data center" and permit_type="ELECTRICAL"
```

### Fiber / conduit tracking (SNA ring construction)
```
Use norfolk_search_row_permits with address="Monticello"
Also try address="Granby" and address="Main"
```

## No Authentication Required

Norfolk's Socrata portal is fully public. No API key needed.
The server makes unauthenticated GET requests to `https://data.norfolk.gov/resource/{dataset_id}.json`.
