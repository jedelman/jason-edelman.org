"""
Norfolk OpenGov MCP Server
--------------------------
Provides Gemini CLI access to Norfolk's Socrata open data portal and
related Virginia public records APIs — datasets that are blocked in
Claude's egress environment but accessible from Gemini's local context.

Datasets covered:
  - Norfolk Permits & Inspections    (bnrb-u445)
  - Norfolk Property Assessment FY26 (m5ya-5grb)
  - Norfolk Right-of-Way Permits     (amvm-vkq5)
  - Norfolk Inspections              (ihzr-5x5n)

Install:
  pip install fastmcp httpx

Register with Gemini CLI:
  gemini mcp add norfolk-opengov --command "python3 /path/to/norfolk_mcp.py"

Or add to .gemini/settings.json (see MCP_SETUP.md in this directory).
"""

import json
import httpx
from typing import Optional
from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, Field, ConfigDict

NORFOLK_BASE = "https://data.norfolk.gov/resource"

mcp = FastMCP("norfolk-opengov")

# ---------------------------------------------------------------------------
# Shared HTTP client
# ---------------------------------------------------------------------------

async def socrata_get(dataset_id: str, params: dict) -> list:
    """Execute a Socrata SODA API query and return parsed JSON."""
    url = f"{NORFOLK_BASE}/{dataset_id}.json"
    # Remove None values
    params = {k: v for k, v in params.items() if v is not None}
    async with httpx.AsyncClient(timeout=30) as client:
        resp = client.get(url, params=params)
        resp.raise_for_status()
        return resp.json()


# ---------------------------------------------------------------------------
# Tool: Search permits and inspections
# ---------------------------------------------------------------------------

class PermitSearchInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    keyword: Optional[str] = Field(
        default=None,
        description="Full-text keyword search across permit fields. "
                    "Examples: 'generator', 'data center', 'electrical', 'mechanical'."
    )
    permit_type: Optional[str] = Field(
        default=None,
        description="Filter by permit type code or description fragment. "
                    "Examples: 'ELECTRICAL', 'MECHANICAL', 'BUILDING'."
    )
    address: Optional[str] = Field(
        default=None,
        description="Street address fragment to filter by. "
                    "Examples: '440 Monticello', 'Brambleton', 'Village Ave'."
    )
    status: Optional[str] = Field(
        default=None,
        description="Permit status. Examples: 'ISSUED', 'PENDING', 'FINALED'."
    )
    issued_after: Optional[str] = Field(
        default=None,
        description="Return permits issued on or after this date. ISO format: 'YYYY-MM-DD'."
    )
    limit: int = Field(
        default=50,
        ge=1,
        le=500,
        description="Maximum number of records to return (1–500). Default 50."
    )


@mcp.tool(
    name="norfolk_search_permits",
    annotations={
        "title": "Search Norfolk Building & Electrical Permits",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    }
)
async def norfolk_search_permits(params: PermitSearchInput) -> str:
    """Search Norfolk's Permits and Inspections dataset (DSC-issued permits).

    Covers building, plumbing, mechanical, electrical, fire, elevator, and
    zoning permits issued by the Norfolk Development Service Center. Updated daily.

    Dataset ID: bnrb-u445

    Use this to:
    - Find generator or data center electrical permits in Norfolk
    - Check permit history for a specific address
    - Monitor large commercial/industrial permit activity
    - Identify new electrical service upgrades (potential substation load signals)

    Returns JSON array of matching permit records.
    """
    where_clauses = []

    if params.permit_type:
        where_clauses.append(
            f"upper(permit_type) like '%{params.permit_type.upper()}%'"
        )
    if params.address:
        where_clauses.append(
            f"upper(address) like '%{params.address.upper()}%'"
        )
    if params.status:
        where_clauses.append(
            f"upper(status) like '%{params.status.upper()}%'"
        )
    if params.issued_after:
        where_clauses.append(
            f"issued_date >= '{params.issued_after}T00:00:00.000'"
        )

    query_params: dict = {"$limit": params.limit}

    if params.keyword:
        query_params["$q"] = params.keyword
    if where_clauses:
        query_params["$where"] = " AND ".join(where_clauses)

    try:
        results = await socrata_get("bnrb-u445", query_params)
        return json.dumps({
            "dataset": "Norfolk Permits & Inspections (bnrb-u445)",
            "query": query_params,
            "count": len(results),
            "records": results,
        }, indent=2)
    except httpx.HTTPStatusError as e:
        return json.dumps({"error": f"HTTP {e.response.status_code}: {e.response.text}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


# ---------------------------------------------------------------------------
# Tool: Property assessment / ownership lookup
# ---------------------------------------------------------------------------

class PropertySearchInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    owner_name: Optional[str] = Field(
        default=None,
        description="Owner name fragment (case-insensitive). "
                    "Examples: 'VIRGINIA ELECTRIC', 'DOMINION', 'WELLS FARGO', 'SNA'."
    )
    address: Optional[str] = Field(
        default=None,
        description="Property address fragment. "
                    "Examples: '440 Monticello', 'Brambleton', '9425 Grove'."
    )
    zip_code: Optional[str] = Field(
        default=None,
        description="5-digit ZIP code. Downtown Norfolk core: '23510', '23517'. "
                    "Ocean View / north: '23503', '23505'."
    )
    parcel_id: Optional[str] = Field(
        default=None,
        description="Norfolk parcel ID (GPIN). Example: '04337700', '26307800'."
    )
    limit: int = Field(
        default=25,
        ge=1,
        le=200,
        description="Maximum records to return (1–200). Default 25."
    )


@mcp.tool(
    name="norfolk_search_property",
    annotations={
        "title": "Search Norfolk Property Assessment Records",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    }
)
async def norfolk_search_property(params: PropertySearchInput) -> str:
    """Search Norfolk's FY26 Property Assessment and Sales dataset.

    Contains ownership, assessed value, parcel ID, address, and sales history
    for all Norfolk parcels. Updated annually.

    Dataset ID: m5ya-5grb

    Use this to:
    - Find all parcels owned by 'Virginia Electric and Power' (Dominion substations)
    - Look up ownership and assessed value for candidate buildings
    - Verify parcel IDs for specific addresses
    - Check sales history and distressed asset indicators

    Key use for Mithlond: query owner_name='VIRGINIA ELECTRIC' with zip_code='23510'
    or '23517' to find Dominion-owned parcels in downtown Norfolk.

    Returns JSON array of matching property records.
    """
    where_clauses = []

    if params.owner_name:
        where_clauses.append(
            f"upper(owner_name) like '%{params.owner_name.upper()}%'"
        )
    if params.address:
        where_clauses.append(
            f"upper(situs_address) like '%{params.address.upper()}%'"
        )
    if params.zip_code:
        where_clauses.append(f"zip_code = '{params.zip_code}'")
    if params.parcel_id:
        where_clauses.append(f"parcel_id = '{params.parcel_id}'")

    query_params: dict = {"$limit": params.limit}
    if where_clauses:
        query_params["$where"] = " AND ".join(where_clauses)

    try:
        results = await socrata_get("m5ya-5grb", query_params)
        return json.dumps({
            "dataset": "Norfolk Property Assessment FY26 (m5ya-5grb)",
            "query": query_params,
            "count": len(results),
            "records": results,
        }, indent=2)
    except httpx.HTTPStatusError as e:
        return json.dumps({"error": f"HTTP {e.response.status_code}: {e.response.text}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


# ---------------------------------------------------------------------------
# Tool: Right-of-way permits (excavations, infrastructure work)
# ---------------------------------------------------------------------------

class ROWPermitInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    address: Optional[str] = Field(
        default=None,
        description="Street name or address fragment. "
                    "Examples: 'Monticello', 'Brambleton', 'Granby', 'York'."
    )
    permit_type: Optional[str] = Field(
        default=None,
        description="ROW permit type fragment. Examples: 'EXCAVATION', 'INSTALLATION', 'CONDUIT'."
    )
    limit: int = Field(default=50, ge=1, le=500)


@mcp.tool(
    name="norfolk_search_row_permits",
    annotations={
        "title": "Search Norfolk Right-of-Way Permits",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    }
)
async def norfolk_search_row_permits(params: ROWPermitInput) -> str:
    """Search Norfolk's Right-of-Way Closure Permits dataset.

    Covers ROW excavations, conduit installations, driveway entrances,
    and infrastructure work in Norfolk public rights-of-way.

    Dataset ID: amvm-vkq5

    Use this to:
    - Find conduit or fiber installations near candidate buildings (SNA ring construction)
    - Identify recent utility work on streets adjacent to 440 Monticello or 101 W Main
    - Track excavation permits that might indicate substation or grid upgrades

    Returns JSON array of matching ROW permit records.
    """
    where_clauses = []
    if params.address:
        where_clauses.append(
            f"upper(location_description) like '%{params.address.upper()}%'"
        )
    if params.permit_type:
        where_clauses.append(
            f"upper(permit_type) like '%{params.permit_type.upper()}%'"
        )

    query_params: dict = {"$limit": params.limit}
    if where_clauses:
        query_params["$where"] = " AND ".join(where_clauses)

    try:
        results = await socrata_get("amvm-vkq5", query_params)
        return json.dumps({
            "dataset": "Norfolk ROW Permits (amvm-vkq5)",
            "query": query_params,
            "count": len(results),
            "records": results,
        }, indent=2)
    except httpx.HTTPStatusError as e:
        return json.dumps({"error": f"HTTP {e.response.status_code}: {e.response.text}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


# ---------------------------------------------------------------------------
# Tool: Dataset schema introspection
# ---------------------------------------------------------------------------

class SchemaInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    dataset_id: str = Field(
        ...,
        description="Socrata dataset ID. Known Norfolk datasets: "
                    "bnrb-u445 (permits), m5ya-5grb (property FY26), "
                    "amvm-vkq5 (ROW permits), ihzr-5x5n (inspections)."
    )


@mcp.tool(
    name="norfolk_get_dataset_schema",
    annotations={
        "title": "Get Norfolk Dataset Column Schema",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    }
)
async def norfolk_get_dataset_schema(params: SchemaInput) -> str:
    """Fetch the column schema for a Norfolk Socrata dataset.

    Returns field names, types, and descriptions so you can construct
    precise $where filters for other tools.

    Use this first if you're unsure what column names to filter on.
    """
    url = f"https://data.norfolk.gov/api/views/{params.dataset_id}.json"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = client.get(url)
            resp.raise_for_status()
            meta = resp.json()
            columns = [
                {
                    "field": col.get("fieldName"),
                    "name": col.get("name"),
                    "type": col.get("dataTypeName"),
                    "description": col.get("description", ""),
                }
                for col in meta.get("columns", [])
            ]
            return json.dumps({
                "dataset_id": params.dataset_id,
                "name": meta.get("name"),
                "description": meta.get("description", ""),
                "row_count": meta.get("rowsUpdatedAt"),
                "columns": columns,
            }, indent=2)
    except httpx.HTTPStatusError as e:
        return json.dumps({"error": f"HTTP {e.response.status_code}: {e.response.text}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    mcp.run()
