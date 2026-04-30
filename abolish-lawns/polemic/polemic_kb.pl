% ============================================================================
% POLEMIC: Knowledge Base Schema & Rules
% A logic engine for argument mapping, debate analysis, and rhetoric
% ============================================================================

% ---------------------------------------------------------------------------
% CORE PREDICATES: Representation Layer
% ---------------------------------------------------------------------------

% claim(ID, Speaker, Text, Type, Confidence, Timestamp)
% Represents any assertion made by a participant
% Speaker: 'user' or 'opponent' or other participant name
% Type: 'empirical' (factual), 'normative' (value-based), 'definitional' (meaning), 
%       'jurisdictional' (scope/authority), 'hypothetical'
% Confidence: 0.0-1.0 (how certain the speaker/we are)

claim(_, _, _, Type, Conf, _) :- 
    atom(Type), 
    member(Type, [empirical, normative, definitional, jurisdictional, hypothetical]),
    number(Conf), 
    Conf >= 0, 
    Conf =< 1.

% fact(ID, Domain, Assertion, Source, Verified, Timestamp)
% Represents grounded, verifiable facts
% Domain: 'water', 'land', 'ecology', 'law', 'economics', etc.
% Source: citation/attribution
% Verified: true/false (has it been independently confirmed?)

fact(_, _, _, _, Verified, _) :- 
    atom(Verified), 
    member(Verified, [true, false]).

% relation(Type, FromID, ToID, Strength, Timestamp)
% Logical relationships between ideas
% Type: 'entails', 'contradicts', 'supports', 'weakens', 'presupposes', 
%       'follows_from', 'equivalent'
% Strength: 0.0-1.0 (how strong is the relationship?)

relation(Type, _, _, Strength, _) :- 
    atom(Type),
    member(Type, [entails, contradicts, supports, weakens, presupposes, follows_from, equivalent]),
    number(Strength),
    Strength >= 0,
    Strength =< 1.

% assumption(ClaimID, Text)
% Explicit assumptions required for a claim to hold

assumption(_, _).

% affect(ClaimID, Emotion, Intensity)
% Emotional/rhetorical charge of a claim
% Emotion: 'shame', 'pride', 'fear', 'hope', 'anger', 'compassion', etc.
% Intensity: 0.0-1.0

affect(_, Emotion, Intensity) :-
    atom(Emotion),
    number(Intensity),
    Intensity >= 0,
    Intensity =< 1.

% speaker(Name, Role)
% Metadata about who's making arguments
% Role: 'advocate', 'opponent', 'expert', 'neutral'

speaker(_, Role) :-
    atom(Role),
    member(Role, [advocate, opponent, expert, neutral]).

% ---------------------------------------------------------------------------
% DERIVED PREDICATES: Query Layer
% ---------------------------------------------------------------------------

% entails(A, B) - A logically implies B
entails(A, B) :- 
    relation(entails, A, B, _).

% contradicts(A, B) - A and B cannot both be true
contradicts(A, B) :- 
    relation(contradicts, A, B, _).

% supports(Evidence, Claim) - Evidence makes claim stronger
supports(E, C) :- 
    relation(supports, E, C, _).

% weakens(Counter, Claim) - Counterexample weakens claim
weakens(Counter, C) :- 
    relation(weakens, Counter, C, _).

% presupposes(Claim, Assumption) - Claim requires assumption to be true
presupposes(C, A) :- 
    relation(presupposes, C, A, _).

% ---------------------------------------------------------------------------
% LOGICAL CLOSURE: Derived Implications
% ---------------------------------------------------------------------------

% transitive_entailment(A, B) - A entails B through chains
% closure(A, B) is the transitive closure of entailment
closure(A, B) :- 
    entails(A, B).
closure(A, C) :- 
    entails(A, B), 
    closure(B, C).

% contradiction_closure(A, B) - A contradicts B (transitively or directly)
% If A contradicts X and X entails B, then A contradicts B (or at least conflicts)
contradiction_chain(A, B) :- 
    contradicts(A, B).
contradiction_chain(A, B) :- 
    contradicts(A, X), 
    entails(X, B).

% ---------------------------------------------------------------------------
% STASIS DETECTION: Finding Actual Points of Disagreement
% ---------------------------------------------------------------------------

% stasis_point(X) - X is a point of actual disagreement
% True iff:
%   - Multiple speakers contradict on X
%   - X is not entailed by a single agreed-upon fact
%   - X is not itself a verified fact

stasis_point(X) :-
    claim(ID, _, _, _, _, _),
    find_contradictions_on(X, Count),
    Count >= 2,
    \+ is_derived_fact(X),
    \+ fact(_, _, X, _, true, _).

% find_contradictions_on(X, Count) - How many claims contradict on X?
find_contradictions_on(X, Count) :-
    findall(Speaker, (
        claim(ID1, Speaker, _, _, _, _),
        (contradicts(ID1, X) ; contradicts(X, ID1))
    ), Speakers),
    length(Speakers, Count),
    Count > 0.

% is_derived_fact(X) - Is X something we've derived as certainly true?
is_derived_fact(X) :-
    claim(ID, _, X, empirical, Conf, _),
    Conf >= 0.9.

% ---------------------------------------------------------------------------
% VULNERABILITY DETECTION: Finding Weak Points
% ---------------------------------------------------------------------------

% vulnerable(Claim) - This claim is vulnerable to attack
% A claim is vulnerable if:
%   - It presupposes something ungrounded
%   - It contradicts a well-supported fact
%   - It has weak confidence but strong implications

vulnerable(Claim) :-
    claim(Claim, _, _, _, Conf, _),
    Conf < 0.7,
    (
        has_strong_implication(Claim)
    ).

% has_weak_foundation(Claim) - Claim rests on unverified assumptions
has_weak_foundation(Claim) :-
    presupposes(Claim, Assumption),
    \+ fact(_, _, Assumption, _, true, _),
    \+ claim(ID, _, Assumption, empirical, HighConf, _),
    HighConf >= 0.8.

% has_strong_implication(Claim) - Claim implies many other things
has_strong_implication(Claim) :-
    findall(X, closure(Claim, X), Implications),
    length(Implications, Count),
    Count >= 3.

% ---------------------------------------------------------------------------
% LEVERAGE DETECTION: Finding High-Impact Claims
% ---------------------------------------------------------------------------

% high_leverage(Claim) - This claim has outsized rhetorical power
% A claim has high leverage if:
%   - It implies many downstream claims
%   - It has high emotional intensity
%   - It's a lynchpin in the argument structure

high_leverage(Claim) :-
    (
        (has_strong_implication(Claim), findall(X, closure(Claim, X), L1), length(L1, C1), C1 >= 3)
        ;
        (findall(Emotion, affect(Claim, Emotion, _), L2), length(L2, C2), C2 >= 2)
        ;
        is_stasis_point(Claim)
    ).

is_stasis_point(X) :-
    stasis_point(X).

% ---------------------------------------------------------------------------
% BURDEN OF PROOF ANALYSIS
% ---------------------------------------------------------------------------

% burden_of_proof(Claim, OnWhom)
% Who has the burden to prove this claim?
% OnWhom: 'advocate' (person making claim), 'opponent' (challenger), 'mutual'

burden_of_proof(Claim, OnWhom) :-
    claim(Claim, Speaker, _, Type, _, _),
    (
        Type = empirical -> 
            OnWhom = advocate  % Empirical claims burden the speaker
        ;
        Type = normative -> 
            OnWhom = mutual    % Value claims are dialogical
        ;
        Type = definitional -> 
            OnWhom = advocate  % Definitions burden the definer
        ;
        Type = jurisdictional -> 
            OnWhom = advocate  % Authority claims need grounding
        ;
        OnWhom = mutual
    ).

% ---------------------------------------------------------------------------
% POSITION RECONSTRUCTION
% ---------------------------------------------------------------------------

% position(Speaker, Stance)
% Reconstructs a participant's full position from their claims

position(Speaker, Stance) :-
    findall(Claim, claim(Claim, Speaker, _, _, _, _), Claims),
    findall(Rel, (
        member(C, Claims),
        relation(RelType, C, Other, _),
        Rel = rel(RelType, C, Other)
    ), Relations),
    Stance = stance(claims=Claims, relations=Relations).

% common_ground(Speaker1, Speaker2, GroundList)
% What do two speakers agree on?

common_ground(Speaker1, Speaker2, Common) :-
    findall(Claim, (
        claim(ClaimID, Speaker1, Claim, _, _, _),
        claim(_, Speaker2, Claim, _, _, _)
    ), Common).

% ---------------------------------------------------------------------------
% RHETORIC ANALYSIS
% ---------------------------------------------------------------------------

% rhetorical_register(ClaimID, Register)
% What kind of appeal does this claim make?
% Register: 'ethos' (credibility), 'pathos' (emotion), 'logos' (logic)

rhetorical_register(Claim, Register) :-
    (
        (speaker(_, Role), Role = expert -> Register = ethos)
        ;
        (affect(Claim, _, Intensity), Intensity > 0.6 -> Register = pathos)
        ;
        (claim(Claim, _, _, empirical, _, _) -> Register = logos)
    ).

% ---------------------------------------------------------------------------
% HELPER PREDICATES
% ---------------------------------------------------------------------------

% all_claims(List)
all_claims(List) :-
    findall(ID, claim(ID, _, _, _, _, _), List).

% all_facts(List)
all_facts(List) :-
    findall(ID, fact(ID, _, _, _, _, _), List).

% speakers_involved(List)
speakers_involved(List) :-
    findall(Speaker, claim(_, Speaker, _, _, _, _), Unique),
    sort(Unique, List).

% ---------------------------------------------------------------------------
% EXPORT/VISUALIZATION HELPERS
% ---------------------------------------------------------------------------

% export_kb_json(JSON)
% Generate JSON representation of the KB for visualization

export_kb_json(json(Claims, Facts, Relations)) :-
    findall(claim(ID, Speaker, Text, Type, Conf), 
            claim(ID, Speaker, Text, Type, Conf, _), 
            Claims),
    findall(fact(ID, Domain, Assertion, Source, Verified), 
            fact(ID, Domain, Assertion, Source, Verified, _), 
            Facts),
    findall(relation(Type, From, To, Strength), 
            relation(Type, From, To, Strength, _), 
            Relations).

% ---------------------------------------------------------------------------
% END OF SCHEMA
% ============================================================================
