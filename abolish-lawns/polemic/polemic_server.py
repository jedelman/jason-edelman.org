#!/usr/bin/env python3
"""
Polemic MCP Server: Prolog Knowledge Base Bridge
Connects Prolog reasoning engine to Claude via MCP
"""

import json
import subprocess
import os
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime

@dataclass
class PrologResult:
    success: bool
    result: Any = None
    error: str = None

class PalemicEngine:
    """Manages Prolog KB and queries"""
    
    def __init__(self, kb_schema_path: str = "polemic_kb.pl", kb_data_path: str = "lawns_debate.json"):
        self.kb_schema_path = kb_schema_path
        self.kb_data_path = kb_data_path
        self.loaded_kb = None
        self.prolog_process = None
        
    def load_kb(self, kb_json: Dict) -> PrologResult:
        """Load JSON KB into memory and prepare Prolog assertions"""
        try:
            self.loaded_kb = kb_json
            self._generate_prolog_facts()
            return PrologResult(success=True, result="KB loaded successfully")
        except Exception as e:
            return PrologResult(success=False, error=str(e))
    
    def _generate_prolog_facts(self) -> str:
        """Generate Prolog assertions from JSON KB"""
        assertions = []
        
        # Assert facts
        for fact in self.loaded_kb.get("facts", []):
            fact_id = fact["id"]
            domain = fact["domain"]
            assertion = fact["assertion"].replace("'", "\\'")
            source = fact["source"].replace("'", "\\'")
            verified = "true" if fact["verified"] else "false"
            timestamp = datetime.now().isoformat()
            
            assertions.append(
                f"assert(fact('{fact_id}', '{domain}', '{assertion}', '{source}', {verified}, '{timestamp}'))."
            )
        
        # Assert claims
        for claim in self.loaded_kb.get("claims", []):
            claim_id = claim["id"]
            speaker = claim["speaker"]
            text = claim["text"].replace("'", "\\'")
            claim_type = claim["type"]
            confidence = claim["confidence"]
            timestamp = datetime.now().isoformat()
            
            assertions.append(
                f"assert(claim('{claim_id}', '{speaker}', '{text}', '{claim_type}', {confidence}, '{timestamp}'))."
            )
        
        # Assert relations
        for rel in self.loaded_kb.get("relations", []):
            rel_type = rel["type"]
            from_id = rel["from"]
            to_id = rel["to"]
            strength = rel["strength"]
            timestamp = datetime.now().isoformat()
            
            assertions.append(
                f"assert(relation('{rel_type}', '{from_id}', '{to_id}', {strength}, '{timestamp}'))."
            )
        
        # Assert affects
        for aff in self.loaded_kb.get("affects", []):
            claim_id = aff["claim"]
            emotion = aff["emotion"]
            intensity = aff["intensity"]
            
            assertions.append(
                f"assert(affect('{claim_id}', '{emotion}', {intensity}))."
            )
        
        return "\n".join(assertions)
    
    def query(self, query_name: str, params: Dict) -> PrologResult:
        """Execute a predefined query with parameters"""
        queries = {
            "entails": self._query_entails,
            "contradicts": self._query_contradicts,
            "closure": self._query_closure,
            "stasis": self._query_stasis,
            "vulnerabilities": self._query_vulnerabilities,
            "leverage": self._query_leverage,
            "position": self._query_position,
            "ground_check": self._query_ground_check,
        }
        
        if query_name not in queries:
            return PrologResult(success=False, error=f"Unknown query: {query_name}")
        
        try:
            result = queries[query_name](params)
            return PrologResult(success=True, result=result)
        except Exception as e:
            return PrologResult(success=False, error=str(e))
    
    def _query_entails(self, params: Dict) -> List[str]:
        """Find what A entails"""
        from_id = params.get("from")
        # In real Prolog: closure(from_id, X)
        # Simulate: look up relations
        implications = []
        for rel in self.loaded_kb.get("relations", []):
            if rel["from"] == from_id and rel["type"] == "entails":
                implications.append(rel["to"])
        return implications
    
    def _query_contradicts(self, params: Dict) -> List[str]:
        """Find what contradicts what"""
        contradictions = []
        for rel in self.loaded_kb.get("relations", []):
            if rel["type"] == "contradicts":
                contradictions.append({
                    "from": rel["from"],
                    "to": rel["to"],
                    "strength": rel["strength"]
                })
        return contradictions
    
    def _query_closure(self, params: Dict) -> List[str]:
        """Find transitive closure of entailments"""
        start = params.get("from")
        visited = set()
        queue = [start]
        closure = []
        
        while queue:
            current = queue.pop(0)
            if current in visited:
                continue
            visited.add(current)
            
            for rel in self.loaded_kb.get("relations", []):
                if rel["from"] == current and rel["type"] == "entails":
                    target = rel["to"]
                    if target not in visited:
                        closure.append(target)
                        queue.append(target)
        
        return closure
    
    def _query_stasis(self, params: Dict) -> List[Dict]:
        """Find points of actual disagreement"""
        stasis_points = []
        
        # Simple heuristic: claims that are contradicted by multiple parties
        for claim in self.loaded_kb.get("claims", []):
            claim_id = claim["id"]
            
            # Count contradictions
            contradictions = [
                rel for rel in self.loaded_kb.get("relations", [])
                if (rel["to"] == claim_id or rel["from"] == claim_id) 
                and rel["type"] == "contradicts"
            ]
            
            if len(contradictions) >= 1:
                stasis_points.append({
                    "claim_id": claim_id,
                    "claim_text": claim["text"],
                    "contradictions": len(contradictions),
                    "confidence": claim["confidence"]
                })
        
        return sorted(stasis_points, key=lambda x: -x["contradictions"])
    
    def _query_vulnerabilities(self, params: Dict) -> List[Dict]:
        """Find weak points in a position"""
        speaker = params.get("speaker", "abolitionist")
        vulnerabilities = []
        
        for claim in self.loaded_kb.get("claims", []):
            if claim["speaker"] != speaker:
                continue
            
            # Low confidence claims are vulnerable
            if claim["confidence"] < 0.75:
                vulnerabilities.append({
                    "claim_id": claim["id"],
                    "claim_text": claim["text"],
                    "confidence": claim["confidence"],
                    "type": claim["type"]
                })
        
        return vulnerabilities
    
    def _query_leverage(self, params: Dict) -> List[Dict]:
        """Find high-impact claims"""
        leverage_points = []
        
        for claim in self.loaded_kb.get("claims", []):
            claim_id = claim["id"]
            
            # Count implications
            implications = len(self._query_closure({"from": claim_id}))
            
            # Count emotional charge
            affects = [a for a in self.loaded_kb.get("affects", []) if a["claim"] == claim_id]
            emotion_score = sum(a["intensity"] for a in affects) / max(len(affects), 1)
            
            # Combine into leverage score
            leverage_score = (implications * 0.7) + (emotion_score * 0.3)
            
            if leverage_score > 0:
                leverage_points.append({
                    "claim_id": claim_id,
                    "claim_text": claim["text"],
                    "implications": implications,
                    "emotional_charge": emotion_score,
                    "leverage_score": leverage_score,
                    "speaker": claim["speaker"]
                })
        
        return sorted(leverage_points, key=lambda x: -x["leverage_score"])
    
    def _query_position(self, params: Dict) -> Dict:
        """Reconstruct a speaker's position"""
        speaker = params.get("speaker", "abolitionist")
        
        position = {
            "speaker": speaker,
            "claims": [],
            "facts_cited": [],
            "logical_structure": []
        }
        
        for claim in self.loaded_kb.get("claims", []):
            if claim["speaker"] == speaker:
                position["claims"].append({
                    "id": claim["id"],
                    "text": claim["text"],
                    "type": claim["type"],
                    "confidence": claim["confidence"]
                })
        
        # Find facts that support this speaker's claims
        claim_ids = [c["id"] for c in position["claims"]]
        for rel in self.loaded_kb.get("relations", []):
            if rel["from"] in claim_ids or rel["to"] in claim_ids:
                position["logical_structure"].append(rel)
        
        return position
    
    def _query_ground_check(self, params: Dict) -> Dict:
        """Check if a claim is grounded in verified facts"""
        claim_id = params.get("claim_id")
        
        # Find the claim
        claim = next((c for c in self.loaded_kb.get("claims", []) if c["id"] == claim_id), None)
        if not claim:
            return {"error": f"Claim {claim_id} not found"}
        
        # Find supporting relations
        supports = [
            rel for rel in self.loaded_kb.get("relations", [])
            if rel["to"] == claim_id and rel["type"] in ["entails", "supports"]
        ]
        
        grounding_facts = []
        for sup in supports:
            fact = next((f for f in self.loaded_kb.get("facts", []) if f["id"] == sup["from"]), None)
            if fact:
                grounding_facts.append({
                    "fact_id": fact["id"],
                    "assertion": fact["assertion"],
                    "source": fact["source"],
                    "verified": fact["verified"]
                })
        
        return {
            "claim_id": claim_id,
            "claim_text": claim["text"],
            "grounded": len(grounding_facts) > 0,
            "grounding_facts": grounding_facts,
            "confidence": claim["confidence"]
        }
    
    def export_graph(self) -> Dict:
        """Export KB as graph nodes and edges for visualization"""
        nodes = []
        edges = []
        
        # Add claim nodes
        for claim in self.loaded_kb.get("claims", []):
            nodes.append({
                "id": claim["id"],
                "type": "claim",
                "label": claim["text"][:50] + "..." if len(claim["text"]) > 50 else claim["text"],
                "speaker": claim["speaker"],
                "confidence": claim["confidence"],
                "claim_type": claim["type"]
            })
        
        # Add fact nodes
        for fact in self.loaded_kb.get("facts", []):
            nodes.append({
                "id": fact["id"],
                "type": "fact",
                "label": fact["assertion"][:50] + "..." if len(fact["assertion"]) > 50 else fact["assertion"],
                "domain": fact["domain"],
                "verified": fact["verified"]
            })
        
        # Add edges from relations
        for rel in self.loaded_kb.get("relations", []):
            edges.append({
                "from": rel["from"],
                "to": rel["to"],
                "type": rel["type"],
                "strength": rel["strength"]
            })
        
        return {
            "nodes": nodes,
            "edges": edges,
            "domain": self.loaded_kb.get("domain", "unknown"),
            "participants": self.loaded_kb.get("participants", [])
        }

# Initialize engine
engine = None

def init_engine(kb_path: str = "lawns_debate.json"):
    """Initialize the Polemic engine"""
    global engine
    try:
        engine = PalemicEngine()
        with open(kb_path, 'r') as f:
            kb_data = json.load(f)
        result = engine.load_kb(kb_data)
        return result
    except Exception as e:
        return PrologResult(success=False, error=str(e))

# MCP Tool handlers (simplified)
def handle_query(query_type: str, params: Dict) -> Dict:
    """Handle MCP query request"""
    if not engine:
        return {"error": "Engine not initialized"}
    
    result = engine.query(query_type, params)
    return {
        "success": result.success,
        "result": result.result,
        "error": result.error
    }

def handle_export() -> Dict:
    """Export graph for visualization"""
    if not engine:
        return {"error": "Engine not initialized"}
    
    return engine.export_graph()

if __name__ == "__main__":
    # Test
    init_result = init_engine("lawns_debate.json")
    print("Init:", init_result)
    
    if init_result.success:
        # Test queries
        print("\n=== STASIS POINTS ===")
        stasis = engine.query("stasis", {})
        print(json.dumps(stasis.result[:2], indent=2))
        
        print("\n=== LEVERAGE POINTS ===")
        leverage = engine.query("leverage", {})
        print(json.dumps(leverage.result[:3], indent=2))
        
        print("\n=== POSITION: ABOLITIONIST ===")
        pos = engine.query("position", {"speaker": "abolitionist"})
        print(json.dumps(pos.result, indent=2))
        
        print("\n=== EXPORT GRAPH ===")
        graph = handle_export()
        print(f"Nodes: {len(graph['nodes'])}, Edges: {len(graph['edges'])}")

