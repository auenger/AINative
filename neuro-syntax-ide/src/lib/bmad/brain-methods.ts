/**
 * 60+ Brainstorming techniques organized into 9 categories.
 * Used by the Brainstorm Workshop Skill to guide ideation sessions.
 */

export type BrainMethodCategory =
  | 'divergent'
  | 'lateral'
  | 'structured'
  | 'collaborative'
  | 'visual'
  | 'constraint-based'
  | 'analogical'
  | 'systematic'
  | 'futuring';

export interface BrainMethodData {
  id: string;
  name: string;
  category: BrainMethodCategory;
  categoryLabel: string;
  duration: string;
  energyLevel: 'low' | 'medium' | 'high';
  description: string;
}

export const BRAIN_METHOD_CATEGORIES: { id: BrainMethodCategory; label: string; icon: string }[] = [
  { id: 'divergent', label: 'Divergent Thinking', icon: 'Explode' },
  { id: 'lateral', label: 'Lateral Thinking', icon: 'Shuffle' },
  { id: 'structured', label: 'Structured Methods', icon: 'LayoutGrid' },
  { id: 'collaborative', label: 'Collaborative', icon: 'Users' },
  { id: 'visual', label: 'Visual Techniques', icon: 'Palette' },
  { id: 'constraint-based', label: 'Constraint-Based', icon: 'Lock' },
  { id: 'analogical', label: 'Analogical', icon: 'GitBranch' },
  { id: 'systematic', label: 'Systematic Innovation', icon: 'Cpu' },
  { id: 'futuring', label: 'Futuring & Speculative', icon: 'Rocket' },
];

export const BRAIN_METHODS: BrainMethodData[] = [
  // ─── Divergent Thinking ───
  { id: 'free-association', name: 'Free Association', category: 'divergent', categoryLabel: 'Divergent Thinking', duration: '5-10 min', energyLevel: 'low', description: 'Rapid word/idea chains without judgment. Let thoughts flow freely to uncover unexpected connections.' },
  { id: 'brainwriting-635', name: 'Brainwriting 6-3-5', category: 'divergent', categoryLabel: 'Divergent Thinking', duration: '15-20 min', energyLevel: 'medium', description: 'Write 3 ideas in 5 min, pass to next person, repeat 6 rounds. Builds on others\' ideas silently.' },
  { id: 'round-robin', name: 'Round-Robin Brainstorm', category: 'divergent', categoryLabel: 'Divergent Thinking', duration: '10-20 min', energyLevel: 'medium', description: 'Each person contributes one idea per round. Ensures equal participation and diverse input.' },
  { id: 'reverse-brainstorm', name: 'Reverse Brainstorming', category: 'divergent', categoryLabel: 'Divergent Thinking', duration: '10-15 min', energyLevel: 'medium', description: 'Ask "How could we make this worse?" then flip negatives into positive solutions.' },
  { id: 'starbursting', name: 'Starbursting', category: 'divergent', categoryLabel: 'Divergent Thinking', duration: '10-15 min', energyLevel: 'medium', description: 'Generate questions (who, what, where, when, why, how) before seeking answers. Deepens understanding.' },
  { id: 'charette', name: 'Charette Procedure', category: 'divergent', categoryLabel: 'Divergent Thinking', duration: '20-30 min', energyLevel: 'high', description: 'Parallel small groups work on sub-problems simultaneously, then rotate and build on each other\'s work.' },
  { id: 'electronic-brainstorm', name: 'Electronic Brainstorming', category: 'divergent', categoryLabel: 'Divergent Thinking', duration: '10-20 min', energyLevel: 'low', description: 'Digital anonymous idea submission. Reduces social loafing and production blocking.' },
  { id: 'crawford-slip', name: 'Crawford Slip Method', category: 'divergent', categoryLabel: 'Divergent Thinking', duration: '10-15 min', energyLevel: 'low', description: 'Write one idea per slip of paper. Anonymity encourages wild ideas without fear of judgment.' },

  // ─── Lateral Thinking ───
  { id: 'scamper', name: 'SCAMPER', category: 'lateral', categoryLabel: 'Lateral Thinking', duration: '15-20 min', energyLevel: 'medium', description: 'Systematic provocation: Substitute, Combine, Adapt, Modify, Put to other use, Eliminate, Reverse.' },
  { id: 'six-thinking-hats', name: 'Six Thinking Hats', category: 'lateral', categoryLabel: 'Lateral Thinking', duration: '20-30 min', energyLevel: 'medium', description: 'Explore from 6 perspectives: Facts, Emotions, Risks, Benefits, Creativity, Process control.' },
  { id: 'po-provocation', name: 'PO Provocation', category: 'lateral', categoryLabel: 'Lateral Thinking', duration: '10-15 min', energyLevel: 'medium', description: 'Deliberately provocative statements ("PO: cars should have square wheels") to escape thinking patterns.' },
  { id: 'concept-fan', name: 'Concept Fan', category: 'lateral', categoryLabel: 'Lateral Thinking', duration: '10-15 min', energyLevel: 'medium', description: 'Start with a fixed idea, fan out to broader concepts, then find new specific approaches.' },
  { id: 'random-entry', name: 'Random Entry', category: 'lateral', categoryLabel: 'Lateral Thinking', duration: '5-10 min', energyLevel: 'low', description: 'Pick a random word/object and force connections to the problem. Breaks fixed thinking patterns.' },
  { id: 'challenge-assumptions', name: 'Challenge Assumptions', category: 'lateral', categoryLabel: 'Lateral Thinking', duration: '10-15 min', energyLevel: 'medium', description: 'List all assumptions about the problem, then systematically challenge each one.' },
  { id: 'escape-thinking', name: 'Escape Thinking', category: 'lateral', categoryLabel: 'Lateral Thinking', duration: '10-15 min', energyLevel: 'medium', description: 'Identify what "must be" then deliberately escape it. "It must be digital" -> "What if it was physical?"' },

  // ─── Structured Methods ───
  { id: 'morphological', name: 'Morphological Analysis', category: 'structured', categoryLabel: 'Structured Methods', duration: '20-30 min', energyLevel: 'high', description: 'Decompose problem into parameters, list options for each, combine systematically to find novel solutions.' },
  { id: 'attribute-listing', name: 'Attribute Listing', category: 'structured', categoryLabel: 'Structured Methods', duration: '15-20 min', energyLevel: 'medium', description: 'List all attributes of existing solution, then modify each attribute systematically to create variations.' },
  { id: 'trs-invention', name: 'TRIZ Invention Principles', category: 'structured', categoryLabel: 'Structured Methods', duration: '20-30 min', energyLevel: 'high', description: 'Apply 40 TRIZ inventive principles (e.g., Segmentation, Asymmetry, Nesting) to resolve contradictions.' },
  { id: 'how-now-wow', name: 'How-Now-Wow Matrix', category: 'structured', categoryLabel: 'Structured Methods', duration: '10-15 min', energyLevel: 'low', description: 'Classify ideas by originality and feasibility: How (innovative but hard), Now (easy but common), Wow (innovative AND feasible).' },
  { id: 'impact-effort', name: 'Impact-Effort Matrix', category: 'structured', categoryLabel: 'Structured Methods', duration: '10 min', energyLevel: 'low', description: 'Plot ideas on 2x2 grid: High Impact/Low Effort (Quick Wins) to Low Impact/High Effort (Money Pit).' },
  { id: 'affinity-diagram', name: 'Affinity Diagram', category: 'structured', categoryLabel: 'Structured Methods', duration: '15-20 min', energyLevel: 'medium', description: 'Group ideas into natural clusters by affinity. Reveals themes and patterns in brainstorm output.' },
  { id: 'dot-voting', name: 'Dot Voting', category: 'structured', categoryLabel: 'Structured Methods', duration: '5-10 min', energyLevel: 'low', description: 'Each person gets dots to vote on favorite ideas. Quick democratic prioritization.' },

  // ─── Collaborative ───
  { id: 'design-thinking', name: 'Design Thinking Ideation', category: 'collaborative', categoryLabel: 'Collaborative', duration: '20-30 min', energyLevel: 'high', description: 'Empathize, Define, Ideate, Prototype, Test. Human-centered approach to creative problem solving.' },
  { id: 'world-cafe', name: 'World Cafe', category: 'collaborative', categoryLabel: 'Collaborative', duration: '30-45 min', energyLevel: 'medium', description: 'Rotate through cafe-style tables, each with a sub-topic. Build on insights from previous groups.' },
  { id: 'open-space', name: 'Open Space Technology', category: 'collaborative', categoryLabel: 'Collaborative', duration: '30-60 min', energyLevel: 'high', description: 'Self-organize around topics you\'re passionate about. Law of two feet: move where you contribute most.' },
  { id: 'fishbowl', name: 'Fishbowl Discussion', category: 'collaborative', categoryLabel: 'Collaborative', duration: '15-25 min', energyLevel: 'medium', description: 'Inner circle discusses while outer circle observes. Tap in to join, tap out to return to observers.' },
  { id: 'gallery-walk', name: 'Gallery Walk', category: 'collaborative', categoryLabel: 'Collaborative', duration: '15-20 min', energyLevel: 'medium', description: 'Ideas displayed on walls. Participants walk, read, add comments/stickers. Organic feedback collection.' },
  { id: 'group-pass', name: 'Group Passing', category: 'collaborative', categoryLabel: 'Collaborative', duration: '10-15 min', energyLevel: 'low', description: 'Each group starts a solution, passes to next group who builds on it. Cross-pollination of ideas.' },

  // ─── Visual Techniques ───
  { id: 'mind-mapping', name: 'Mind Mapping', category: 'visual', categoryLabel: 'Visual Techniques', duration: '10-20 min', energyLevel: 'low', description: 'Central topic radiates branches of related ideas. Visual hierarchy reveals structure and gaps.' },
  { id: 'mood-board', name: 'Mood Board', category: 'visual', categoryLabel: 'Visual Techniques', duration: '15-20 min', energyLevel: 'medium', description: 'Collect images, colors, textures that evoke the desired feeling. Tangible, emotional exploration.' },
  { id: 'storyboard', name: 'Storyboarding', category: 'visual', categoryLabel: 'Visual Techniques', duration: '15-25 min', energyLevel: 'medium', description: 'Sketch the user journey frame by frame. Reveals touchpoints, emotions, and opportunities.' },
  { id: 'collage', name: 'Collage Creation', category: 'visual', categoryLabel: 'Visual Techniques', duration: '15-20 min', energyLevel: 'medium', description: 'Cut and paste visual elements to represent concepts. Tactile process unlocks different thinking.' },
  { id: 'sketchnoting', name: 'Sketchnoting', category: 'visual', categoryLabel: 'Visual Techniques', duration: '10-15 min', energyLevel: 'medium', description: 'Combine handwriting, shapes, and simple drawings to capture and explore ideas visually.' },
  { id: 'concept-map', name: 'Concept Mapping', category: 'visual', categoryLabel: 'Visual Techniques', duration: '10-15 min', energyLevel: 'medium', description: 'Structured diagram showing relationships between concepts with labeled connecting arrows.' },

  // ─── Constraint-Based ───
  { id: 'constraint-removal', name: 'Constraint Removal', category: 'constraint-based', categoryLabel: 'Constraint-Based', duration: '10-15 min', energyLevel: 'medium', description: 'Remove one constraint at a time (budget, technology, time, regulations) and explore freely.' },
  { id: 'worst-idea', name: 'Worst Idea First', category: 'constraint-based', categoryLabel: 'Constraint-Based', duration: '5-10 min', energyLevel: 'low', description: 'Generate deliberately terrible ideas. Removes pressure and often sparks genuine insights by inversion.' },
  { id: 'budget-zero', name: 'Zero Budget Thinking', category: 'constraint-based', categoryLabel: 'Constraint-Based', duration: '10-15 min', energyLevel: 'medium', description: 'Solve the problem with zero money. Forces resourcefulness and unconventional approaches.' },
  { id: 'time-box', name: 'Extreme Timeboxing', category: 'constraint-based', categoryLabel: 'Constraint-Based', duration: '5 min', energyLevel: 'high', description: 'Generate as many ideas as possible in 5 minutes. Quantity over quality, avoid self-censorship.' },
  { id: 'resources-swiss-army', name: 'Swiss Army Knife Constraint', category: 'constraint-based', categoryLabel: 'Constraint-Based', duration: '10-15 min', energyLevel: 'medium', description: 'You can only use one multi-purpose tool/technology. How would you solve it? Simplifies thinking.' },
  { id: 'alien-perspective', name: 'Alien Perspective', category: 'constraint-based', categoryLabel: 'Constraint-Based', duration: '10-15 min', energyLevel: 'medium', description: 'Explain the problem to someone from another planet. Reveals hidden assumptions and generates fresh angles.' },

  // ─── Analogical ───
  { id: 'biomimicry', name: 'Biomimicry', category: 'analogical', categoryLabel: 'Analogical', duration: '15-20 min', energyLevel: 'medium', description: 'How does nature solve this? Study biological strategies and translate them to your domain.' },
  { id: 'cross-industry', name: 'Cross-Industry Analogy', category: 'analogical', categoryLabel: 'Analogical', duration: '10-15 min', energyLevel: 'medium', description: 'Find parallels from completely different industries. What can aviation teach healthcare? What can gaming teach education?' },
  { id: 'metaphorical', name: 'Metaphorical Thinking', category: 'analogical', categoryLabel: 'Analogical', duration: '10-15 min', energyLevel: 'medium', description: 'Frame the problem as a metaphor ("Our app is like a library...") and explore the metaphor deeply.' },
  { id: 'historical-parallel', name: 'Historical Parallel', category: 'analogical', categoryLabel: 'Analogical', duration: '10-15 min', energyLevel: 'medium', description: 'Study how similar challenges were solved historically. Ancient wisdom applied to modern problems.' },
  { id: 'direct-analogy', name: 'Direct Analogy', category: 'analogical', categoryLabel: 'Analogical', duration: '10-15 min', energyLevel: 'low', description: 'Find a direct structural analogy from another field and map its solution pattern to your problem.' },
  { id: 'personal-analogy', name: 'Personal Analogy', category: 'analogical', categoryLabel: 'Analogical', duration: '10-15 min', energyLevel: 'medium', description: 'Become the object/problem. "I am the user onboarding flow..." Feel the problem from inside.' },

  // ─── Systematic Innovation ───
  { id: 'triz-contradiction', name: 'TRIZ Contradiction Matrix', category: 'systematic', categoryLabel: 'Systematic Innovation', duration: '20-30 min', energyLevel: 'high', description: 'Identify technical contradictions in your problem, then use the 39x39 matrix to find which of 40 inventive principles apply.' },
  { id: 'function-analysis', name: 'Function Analysis', category: 'systematic', categoryLabel: 'Systematic Innovation', duration: '15-20 min', energyLevel: 'high', description: 'Map all functions (useful and harmful) in the system. Identify and eliminate harmful functions systematically.' },
  { id: 's-curve', name: 'S-Curve Analysis', category: 'systematic', categoryLabel: 'Systematic Innovation', duration: '10-15 min', energyLevel: 'medium', description: 'Plot your solution on the S-curve of evolution. Are you at infancy, growth, maturity, or decline? What\'s next?' },
  { id: 'innovation-trends', name: 'Innovation Trends (TRIZ)', category: 'systematic', categoryLabel: 'Systematic Innovation', duration: '15-20 min', energyLevel: 'high', description: 'Apply TRIZ trends: increased flexibility, increased ideality, transition to micro-level, etc.' },
  { id: 'root-cause', name: 'Root Cause Analysis (5 Whys)', category: 'systematic', categoryLabel: 'Systematic Innovation', duration: '10-15 min', energyLevel: 'low', description: 'Ask "Why?" five times to reach the root cause. Then ideate solutions for the root, not symptoms.' },
  { id: 'pugh-matrix', name: 'Pugh Matrix', category: 'systematic', categoryLabel: 'Systematic Innovation', duration: '15-20 min', energyLevel: 'medium', description: 'Compare multiple solution concepts against a baseline using weighted criteria. Structured decision making.' },

  // ─── Futuring & Speculative ───
  { id: 'scenario-planning', name: 'Scenario Planning', category: 'futuring', categoryLabel: 'Futuring & Speculative', duration: '20-30 min', energyLevel: 'high', description: 'Create 3-4 plausible future scenarios. Test your ideas against each scenario for robustness.' },
  { id: 'backcasting', name: 'Backcasting', category: 'futuring', categoryLabel: 'Futuring & Speculative', duration: '15-20 min', energyLevel: 'medium', description: 'Imagine a successful future state, then work backwards. "In 5 years we achieved X. What happened in year 3?"' },
  { id: 'future-wheel', name: 'Future Wheel', category: 'futuring', categoryLabel: 'Futuring & Speculative', duration: '15-20 min', energyLevel: 'medium', description: 'Start with a trend/change, then map direct and indirect consequences outward in concentric rings.' },
  { id: 'science-fiction', name: 'Science Fiction Prototyping', category: 'futuring', categoryLabel: 'Futuring & Speculative', duration: '20-30 min', energyLevel: 'high', description: 'Write a short sci-fi story set in 2035 using your product. Imagination-driven exploration of possibilities.' },
  { id: 'time-travel', name: 'Time Travel Technique', category: 'futuring', categoryLabel: 'Futuring & Speculative', duration: '10-15 min', energyLevel: 'medium', description: 'Visit the problem from 10 years past and 10 years future. How does time-shifted perspective change solutions?' },
  { id: 'magic-wand', name: 'Magic Wand', category: 'futuring', categoryLabel: 'Futuring & Speculative', duration: '5-10 min', energyLevel: 'low', description: 'If you had unlimited power, what would you create? Remove all constraints to find your ideal vision.' },
  { id: 'pre-mortem', name: 'Pre-Mortem', category: 'futuring', categoryLabel: 'Futuring & Speculative', duration: '10-15 min', energyLevel: 'medium', description: 'Imagine the project failed spectacularly. What went wrong? Use failure insights to strengthen your ideas.' },
];

/** Get methods by category */
export function getMethodsByCategory(category: BrainMethodCategory): BrainMethodData[] {
  return BRAIN_METHODS.filter((m) => m.category === category);
}

/** Get a random method */
export function getRandomMethod(): BrainMethodData {
  return BRAIN_METHODS[Math.floor(Math.random() * BRAIN_METHODS.length)];
}

/** Get a method by id */
export function getMethodById(id: string): BrainMethodData | undefined {
  return BRAIN_METHODS.find((m) => m.id === id);
}

/** Total count of methods */
export const METHOD_COUNT = BRAIN_METHODS.length;
