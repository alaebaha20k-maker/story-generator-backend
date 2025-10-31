const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later.'
});
app.use('/api/', limiter);

// Load API keys from environment
const apiKeys = [];
for (let i = 1; i <= 10; i++) {
    const key = process.env[`GEMINI_KEY_${i}`];
    if (key) apiKeys.push(key);
}

let currentKeyIndex = 0;

function getNextApiKey() {
    if (apiKeys.length === 0) {
        throw new Error('No API keys configured');
    }
    const key = apiKeys[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
    return key;
}

// ⚡ PERFECT CHUNK CONFIGURATION - Uses REAL API limits (8192 tokens = ~5500 chars)
function getChunkConfig(targetLength) {
    const CHARS_PER_CHUNK = 5500; // Maximum reliable output per API call
    
    if (targetLength <= 10000) {
        return { chunks: 2, charsPerChunk: 5500 };
    } else if (targetLength <= 30000) {
        return { chunks: 6, charsPerChunk: 5500 };
    } else if (targetLength <= 60000) {
        return { chunks: 12, charsPerChunk: 5500 };
    } else if (targetLength <= 100000) {
        return { chunks: 20, charsPerChunk: 5500 };
    } else {
        return { chunks: 25, charsPerChunk: 5500 };
    }
}

// 📖 STORY ARC PROGRESSION - Professional pacing system
function getSectionGoal(partNum, totalParts) {
    const progress = partNum / totalParts;
    
    if (progress <= 0.15) {
        return `**HOOK & SETUP (Part ${partNum}/${totalParts})**
- Open with a compelling scene that grabs attention immediately
- Introduce protagonist with vivid physical and personality details
- Establish the ordinary world with rich sensory descriptions
- Plant seeds of conflict or unease
- End with a hook that pulls reader forward`;
    }
    
    if (progress <= 0.35) {
        return `**RISING ACTION (Part ${partNum}/${totalParts})**
- Deepen character development through action and dialogue
- Introduce supporting characters with distinct voices
- Escalate initial conflict with new complications
- Build world details naturally through character interactions
- Increase tension with every scene`;
    }
    
    if (progress <= 0.50) {
        return `**COMPLICATIONS & STAKES (Part ${partNum}/${totalParts})**
- Raise stakes significantly - show what's truly at risk
- Add layers of complexity to the main conflict
- Develop subplots that interweave with main story
- Show character flaws creating additional problems
- Push protagonist toward a difficult decision`;
    }
    
    if (progress <= 0.65) {
        return `**MIDPOINT CRISIS (Part ${partNum}/${totalParts})**
- Deliver a major revelation or twist that changes everything
- Force protagonist to confront their deepest fears or flaws
- Shift power dynamics between characters
- Accelerate pacing with back-to-back intense scenes
- End on a cliffhanger or emotional gut-punch`;
    }
    
    if (progress <= 0.80) {
        return `**ESCALATION & DARKNESS (Part ${partNum}/${totalParts})**
- Everything falls apart - all seems lost
- Protagonist hits rock bottom emotionally or physically
- Allies may turn, enemies may gain advantage
- Force impossible choices with no good options
- Build to maximum tension before climax`;
    }
    
    if (progress <= 0.95) {
        return `**CLIMAX & CONFRONTATION (Part ${partNum}/${totalParts})**
- Deliver the ultimate showdown or confrontation
- Use everything learned and developed throughout story
- Write action with precise choreography and sensory immersion
- Show character growth through their choices and actions
- Make victory/resolution earned, not given`;
    }
    
    return `**RESOLUTION & CLOSURE (Part ${partNum}/${totalParts})**
- Resolve ALL major plot threads with satisfying conclusions
- Show aftermath and consequences of climactic events
- Provide character reflection on their journey and growth
- Tie up subplots meaningfully
- End with emotional resonance - give reader a lasting feeling
- Final image should be memorable and thematically powerful`;
}

// 🎨 ULTRA-DETAILED FIRST CHUNK PROMPT - Professional story opening
function buildFirstChunkPrompt(title, niche, tone, plot, styleExample, extraInstructions, config, partNum, characterDetails) {
    const sectionGoal = getSectionGoal(partNum, config.chunks);
    
    return `You are an award-winning professional author creating a ${niche} story that will captivate readers from the first sentence.

🎯 **CRITICAL OUTPUT REQUIREMENT**: Write EXACTLY 5,500 characters for this chunk (Part ${partNum} of ${config.chunks})

═══════════════════════════════════════════════════════════════════

**STORY FOUNDATION:**

📚 Title: "${title}"
🎭 Genre: ${niche}
🎨 Tone: ${tone}

**PLOT BLUEPRINT:**
${plot}

${characterDetails ? `**CHARACTER PROFILES:**
${characterDetails}
` : ''}

**WRITING STYLE REFERENCE:**
${styleExample}

${extraInstructions ? `**SPECIAL INSTRUCTIONS:**
${extraInstructions}
` : ''}

═══════════════════════════════════════════════════════════════════

${sectionGoal}

═══════════════════════════════════════════════════════════════════

**🔥 ULTRA-DETAILED WRITING REQUIREMENTS:**

**1. SENSORY IMMERSION (CRITICAL):**
   ✅ EVERY scene must include 3+ sensory details (sight, sound, smell, touch, taste)
   ✅ Use specific, vivid imagery - NO generic descriptions
   ✅ Show temperature, texture, lighting, sounds, smells in EVERY paragraph
   ✅ Make reader FEEL like they're physically present in the scene
   
   ❌ BAD: "The room was dark"
   ✅ GOOD: "Shadows pooled in the corners where the single flickering bulb couldn't reach, and the air tasted of rust and mildew"

**2. CHARACTER DEPTH (MANDATORY):**
   ✅ Show character personality through ACTIONS and CHOICES, not description
   ✅ Include internal thoughts and emotional reactions constantly
   ✅ Give each character a distinct voice in dialogue (word choice, rhythm, mannerisms)
   ✅ Reveal character through: body language, micro-expressions, nervous habits
   ✅ Show contradictions - humans are complex, not one-dimensional
   
   ❌ BAD: "John was brave"
   ✅ GOOD: "John's hands trembled as he loaded the revolver, but he stepped forward anyway, jaw set"

**3. DIALOGUE EXCELLENCE:**
   ✅ Natural speech patterns - people interrupt, trail off, use contractions
   ✅ Subtext - characters rarely say exactly what they mean
   ✅ Distinct voices - each character speaks differently
   ✅ Include beats between dialogue (actions, reactions, internal thoughts)
   ✅ Use dialogue to reveal character and advance plot simultaneously
   
   ❌ BAD: "Hello," said John. "How are you?" 
   ✅ GOOD: "Hey." John didn't look up from his phone. A pause. "You good, or...?"

**4. PACING MASTERY:**
   ✅ Vary sentence length for rhythm (short = tension, long = detail/emotion)
   ✅ Action scenes: Short, punchy sentences. Rapid-fire.
   ✅ Emotional scenes: Longer, flowing sentences with internal reflection
   ✅ Use paragraph breaks to control reading speed
   ✅ NEVER rush important moments - milk emotional beats

**5. SHOW DON'T TELL (ABSOLUTE RULE):**
   ✅ Physical reactions instead of emotion labels
   ✅ Environmental details that create mood
   ✅ Character actions that reveal personality
   
   ❌ BAD: "She was angry"
   ✅ GOOD: "Her knuckles went white around the coffee mug. She set it down with exaggerated care"

**6. PROSE QUALITY:**
   ✅ Use strong, specific verbs (not "walked" - "stumbled/strode/crept")
   ✅ Eliminate filter words (saw, heard, felt, watched) - just describe it
   ✅ Vary sentence structure to avoid monotony
   ✅ Use metaphors and similes SPARINGLY but powerfully
   ✅ Every word must earn its place - no fluff

**7. SCENE CONSTRUCTION:**
   ✅ Ground reader in space immediately (where are we?)
   ✅ Establish time of day, weather, atmosphere
   ✅ Use environment to reflect character emotional state
   ✅ Every scene must have: goal, conflict, outcome
   ✅ End scenes on hooks or emotional beats

**8. CHARACTER CONSISTENCY (CRITICAL FOR MULTI-CHUNK):**
   ✅ Establish character names CLEARLY in first mention
   ✅ Use CONSISTENT names throughout (if you name someone "Alexander", don't suddenly call him "Alex")
   ✅ Note physical details you establish (hair color, height, scars) for continuity
   ✅ Keep personality traits consistent
   ✅ Track what characters know and don't know

**9. DETAIL DENSITY:**
   ✅ MAXIMUM detail in opening paragraphs (set the world)
   ✅ Describe clothing, posture, environment, lighting, sounds
   ✅ Include small world-building details that make setting real
   ✅ Use specific numbers, times, dates when relevant
   ✅ Name streets, buildings, objects - specificity creates reality

**10. NARRATIVE TECHNIQUE:**
   ✅ Use deep POV - get inside character's head completely
   ✅ Mix action with internal monologue fluidly
   ✅ Use present-tense thoughts to create immediacy
   ✅ Layer physical sensation with emotional reaction
   ✅ Create dramatic irony when possible (reader knows what character doesn't)

═══════════════════════════════════════════════════════════════════

**📏 CHARACTER COUNT TARGET: EXACTLY 5,500 CHARACTERS**

This is Part 1 of ${config.chunks} - set up your story foundation with MAXIMUM richness and detail. Every sentence should be carefully crafted. Every description should immerse the reader deeper into your world.

**BEGIN WRITING NOW:**`;
}

// 🔄 SEAMLESS CONTINUATION PROMPT - Maintains quality across chunks
function buildContinuationPrompt(title, niche, tone, previousContext, config, partNum, characterTracker) {
    const sectionGoal = getSectionGoal(partNum, config.chunks);
    const isLastChunk = partNum === config.chunks;
    
    let prompt = `Continue the ${niche} story seamlessly. Part ${partNum} of ${config.chunks}.

🎯 **TARGET: EXACTLY 5,500 characters for THIS PART**

═══════════════════════════════════════════════════════════════════

**PREVIOUS STORY CONTEXT (where we left off):**

${previousContext}

═══════════════════════════════════════════════════════════════════

**⚡ SEAMLESS CONTINUATION RULES (CRITICAL):**

1. **CONTINUITY IS SACRED:**
   ✅ Pick up EXACTLY where previous part ended - no time jumps or gaps
   ✅ Continue mid-sentence if previous part ended mid-action
   ✅ Maintain same scene/location unless there's a natural transition
   ✅ Keep narrative momentum - don't reset or restart

2. **CHARACTER CONSISTENCY (ABSOLUTE):**
   ✅ Use EXACT same character names as established (check previous context!)
   ✅ Keep same personality, speech patterns, physical descriptions
   ✅ Remember what characters have learned and experienced
   ✅ Track emotional states - characters don't reset between chunks

${characterTracker ? `
**ESTABLISHED CHARACTERS:**
${characterTracker}
` : ''}

3. **NO RECAP OR REPETITION:**
   ❌ Do NOT summarize what already happened
   ❌ Do NOT reintroduce characters we already know
   ❌ Do NOT re-describe locations we've already seen
   ✅ Move story FORWARD with new events, dialogue, revelations

4. **TONAL CONSISTENCY:**
   ✅ Match the writing style of previous parts exactly
   ✅ Maintain same level of detail density
   ✅ Keep same pacing approach (fast/slow as established)
   ✅ Preserve atmosphere and mood

═══════════════════════════════════════════════════════════════════

${sectionGoal}

═══════════════════════════════════════════════════════════════════
`;

    if (isLastChunk) {
        prompt += `
🔥 **THIS IS THE FINAL PART - COMPLETE THE STORY POWERFULLY!**

**ENDING REQUIREMENTS (ALL MANDATORY):**

1. **RESOLVE ALL PLOT THREADS:**
   ✅ Main conflict must reach definitive conclusion
   ✅ All subplots must be addressed (even if briefly)
   ✅ Answer all major questions raised in the story
   ✅ No loose ends that feel accidental

2. **DELIVER EPIC CLIMAX:**
   ✅ Build to the highest point of tension/action/emotion
   ✅ Use everything set up throughout the story (callbacks, setups paying off)
   ✅ Show character growth through their climactic choices
   ✅ Make resolution EARNED through character effort, not luck

3. **PROVIDE SATISFYING AFTERMATH:**
   ✅ Show immediate consequences of climactic events
   ✅ Give characters moment to reflect on their journey
   ✅ Demonstrate how characters have changed/grown
   ✅ Address supporting characters' fates

4. **EMOTIONAL CLOSURE:**
   ✅ Resolve emotional arcs (relationships, internal conflicts)
   ✅ Provide catharsis appropriate to the story's tone
   ✅ Leave reader with a lasting feeling (hope, melancholy, triumph, etc.)
   ✅ Create sense of completion while honoring the journey

5. **MEMORABLE FINAL IMAGE:**
   ✅ End with a powerful, visual final scene
   ✅ Echo themes established throughout story
   ✅ Leave reader with something to remember
   ✅ Make last paragraph/sentence resonate emotionally

6. **NO RUSHED ENDING:**
   ✅ Use full 5,500 characters - don't wrap up too quickly
   ✅ Give important moments proper time and detail
   ✅ Don't skip from climax straight to "five years later"
   ✅ Let emotional beats breathe

═══════════════════════════════════════════════════════════════════
`;
    }

    prompt += `
**🔥 MAINTAIN ULTRA-DETAILED WRITING:**

✅ EVERY paragraph needs sensory details (sight, sound, smell, touch, taste)
✅ Deep POV - constant internal thoughts and emotional reactions
✅ Natural dialogue with subtext and distinct character voices
✅ Varied pacing - short punchy sentences for action, longer for emotion
✅ Show don't tell - physical reactions instead of emotion labels
✅ Strong specific verbs and vivid imagery
✅ Scene grounding - reader always knows where/when/who
✅ MAXIMUM detail density throughout

**📏 TARGET: EXACTLY 5,500 CHARACTERS**

Continue the story NOW (Part ${partNum}/${config.chunks}):`;

    return prompt;
}

// 🎯 EXTRACT CLEAN CONTEXT - Better context window for continuity
function extractCleanContext(text) {
    if (!text || text.length < 100) return text;
    
    // Take last 1500 characters for better context
    const contextLength = Math.min(1500, text.length);
    let context = text.slice(-contextLength);
    
    // Try to start at a sentence boundary
    const firstPeriod = context.indexOf('. ');
    if (firstPeriod > 0 && firstPeriod < 300) {
        context = context.slice(firstPeriod + 2);
    }
    
    return context.trim();
}

// 📊 CHARACTER TRACKING - Maintain consistency across chunks
function extractCharacterInfo(text) {
    // Simple character name extraction (names are typically capitalized words)
    const namePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g;
    const matches = text.match(namePattern) || [];
    
    // Count occurrences to find main characters
    const nameCounts = {};
    matches.forEach(name => {
        // Filter out common words that aren't names
        const excludeWords = ['The', 'A', 'An', 'This', 'That', 'These', 'Those', 'He', 'She', 'It', 'They', 'I', 'We'];
        if (!excludeWords.includes(name)) {
            nameCounts[name] = (nameCounts[name] || 0) + 1;
        }
    });
    
    // Get top mentioned names (likely main characters)
    const mainCharacters = Object.entries(nameCounts)
        .filter(([_, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name);
    
    if (mainCharacters.length > 0) {
        return `Key Characters: ${mainCharacters.join(', ')}`;
    }
    
    return '';
}

// 🤖 GEMINI API CALL - Robust with retries
async function callGeminiAPI(prompt, apiKey, maxRetries = 3) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await axios.post(url, {
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.9,
                    topP: 0.95,
                    topK: 64,
                    maxOutputTokens: 8192,
                    candidateCount: 1
                }
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 120000
            });

            if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                return response.data.candidates[0].content.parts[0].text;
            }
            throw new Error('Invalid response format from Gemini API');
            
        } catch (error) {
            console.error(`❌ Attempt ${attempt + 1} failed:`, error.message);
            
            if (attempt === maxRetries - 1) {
                throw new Error(`API call failed after ${maxRetries} attempts: ${error.message}`);
            }
            
            // Handle rate limiting and connection issues
            if (error.response?.status === 429 || error.code === 'ECONNABORTED') {
                const waitTime = 2000 * (attempt + 1);
                console.log(`⏳ Waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            } else if (error.response?.status >= 500) {
                // Server error - retry
                await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
                throw error;
            }
        }
    }
}

// 🚀 AUTO-GENERATE STORY DETAILS - Ultra-detailed planning
app.post('/api/auto-generate-details', async (req, res) => {
    try {
        const { title } = req.body;

        if (!title || title.trim().length === 0) {
            return res.status(400).json({ 
                error: 'Title is required',
                success: false 
            });
        }

        console.log(`\n🤖 Auto-generating detailed story plan for: "${title}"`);

        const prompt = `You are an expert story consultant and creative writing professor. Based on the title "${title}", create a comprehensive, professional story plan.

**CRITICAL**: Return ONLY valid JSON - no markdown, no code blocks, no explanation text.

Generate this EXACT structure:

{
  "niche": "Select the MOST fitting genre from: Fantasy, Sci-Fi, Romance, Horror, Mystery, Thriller, Adventure, Drama, Comedy, Historical Fiction, Urban Fantasy, Cyberpunk, Dystopian, Superhero, Western, Post-Apocalyptic, Paranormal, Crime, War, Slice of Life, Steampunk, Space Opera, Military, Noir, Gothic, Supernatural, Time Travel, Alternate History, Magical Realism, Young Adult, Epic Fantasy, Dark Fantasy, High Fantasy, Sword and Sorcery, Zombie, Vampire, Werewolf, Alien, Psychological, Action, Espionage, Heist, Sports, Political, Legal, Medical, Detective, Cozy Mystery, Hard Boiled, Revenge, Survival, Coming of Age",
  
  "tone": "Select the MOST fitting tone: Dark and gritty, Epic and heroic, Light and humorous, Mysterious and suspenseful, Romantic and emotional, Action-packed and intense, Philosophical and thoughtful, Horrifying and tense, Whimsical and magical, Noir and cynical, Inspirational and uplifting, Melancholic and introspective",
  
  "protagonist": {
    "name": "Full character name (first and last)",
    "age": 25,
    "physicalDescription": "Detailed appearance - height, build, hair, eyes, distinguishing features, typical clothing",
    "personality": "Rich personality description - 5+ traits with how they manifest in behavior",
    "background": "Detailed backstory - where they came from, key life events, current situation",
    "goal": "What they desperately want at story start",
    "motivation": "WHY they want it - emotional/psychological driver",
    "flaw": "Internal weakness or fear that holds them back",
    "strength": "Special skill, ability, or character trait that helps them",
    "voice": "How they speak - formal/casual, vocabulary level, speech patterns"
  },
  
  "antagonist": {
    "name": "Full name or title",
    "description": "Physical appearance and presence",
    "personality": "What makes them compelling, not just evil",
    "motivation": "Why they oppose the protagonist - their own valid reasons",
    "power": "What advantage they have over protagonist",
    "connection": "How they relate to protagonist personally"
  },
  
  "setting": {
    "world": "Detailed world/location description - geography, climate, culture, technology level, society structure",
    "time": "Specific time period/era with relevant context",
    "atmosphere": "Overall mood and feeling of the world - sensory details",
    "uniqueElements": "What makes this setting special or different"
  },
  
  "plot": {
    "hook": "Opening scene description - start in media res with immediate tension",
    "incitingIncident": "The event that disrupts protagonist's normal world",
    "mainConflict": "Central problem that drives the entire story",
    "stakes": "What happens if protagonist fails - personal AND larger consequences",
    "complications": "3-4 major obstacles or twists that escalate tension",
    "midpoint": "Major revelation or reversal that changes everything",
    "darkestMoment": "When all seems lost - protagonist's lowest point",
    "climax": "Final confrontation - how the main conflict comes to a head",
    "resolution": "How story resolves - both plot and emotional threads"
  },
  
  "supportingCharacters": [
    {
      "name": "Character name",
      "role": "Ally/Mentor/Love Interest/etc",
      "personality": "Brief personality sketch",
      "function": "What role they play in story"
    }
  ],
  
  "themes": ["Major theme 1", "Major theme 2", "Underlying theme 3"],
  
  "styleExample": "Write a 600-800 character sample of actual story prose in the EXACT style this story should be written. Include: vivid description, character voice, dialogue, action, and sensory details. Make it compelling and match the tone perfectly. This is a WRITING SAMPLE, not a description of style.",
  
  "keyScenes": [
    "Brief description of 3-4 crucial scenes that must happen",
    "Include opening, midpoint twist, climax"
  ],
  
  "emotionalArc": "How protagonist changes emotionally from beginning to end",
  
  "suggestedLength": 60000
}

**REQUIREMENTS:**
- Be SPECIFIC with all details (no generic descriptions)
- Make characters feel REAL with depth and contradictions  
- Create COMPELLING conflict with high stakes
- Ensure plot has clear structure: setup → rising action → climax → resolution
- Style example MUST be actual prose, not description
- All characters must have distinct personalities
- Setting must feel vivid and immersive
- Themes should emerge naturally from plot

**OUTPUT ONLY THE JSON - START WITH { AND END WITH }**`;

        const apiKey = getNextApiKey();
        const response = await callGeminiAPI(prompt, apiKey);

        // Clean response to extract JSON
        let jsonStr = response.trim();
        
        // Remove markdown code blocks if present
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        
        // Find JSON object (look for outermost braces)
        const firstBrace = jsonStr.indexOf('{');
        const lastBrace = jsonStr.lastIndexOf('}');
        
        if (firstBrace === -1 || lastBrace === -1) {
            throw new Error('No valid JSON found in API response');
        }
        
        jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
        
        const details = JSON.parse(jsonStr);

        // Validate required fields
        const requiredFields = ['niche', 'tone', 'protagonist', 'setting', 'plot', 'styleExample'];
        const missingFields = requiredFields.filter(field => !details[field]);
        
        if (missingFields.length > 0) {
            throw new Error(`Generated details missing required fields: ${missingFields.join(', ')}`);
        }

        console.log(`✅ Story details generated successfully`);
        console.log(`   Genre: ${details.niche}`);
        console.log(`   Protagonist: ${details.protagonist?.name || 'N/A'}`);
        console.log(`   Tone: ${details.tone}`);

        res.json({
            success: true,
            details: details
        });

    } catch (error) {
        console.error('❌ Auto-generation error:', error.message);
        res.status(500).json({
            error: error.message || 'Failed to auto-generate story details',
            success: false
        });
    }
});

// 🌊 SSE STREAMING ENDPOINT - Real-time story generation
app.post('/api/generate-stream', async (req, res) => {
    try {
        const { 
            title, 
            niche, 
            tone, 
            plot, 
            styleExample, 
            extraInstructions, 
            targetLength = 60000,
            characterDetails 
        } = req.body;

        // Validation
        if (!title || !niche || !tone || !plot || !styleExample) {
            return res.status(400).json({ 
                error: 'Missing required fields: title, niche, tone, plot, styleExample',
                success: false 
            });
        }

        // Set up SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.flushHeaders();

        console.log(`\n🚀 Starting STREAMING generation: "${title}"`);
        console.log(`📏 Target length: ${targetLength.toLocaleString()} characters`);
        console.log(`🎭 Genre: ${niche} | Tone: ${tone}`);

        const config = getChunkConfig(targetLength);
        const chunks = [];
        let characterTracker = '';

        // Send initial config
        res.write(`data: ${JSON.stringify({
            type: 'init',
            totalChunks: config.chunks,
            targetLength: targetLength,
            charsPerChunk: config.charsPerChunk
        })}\n\n`);

        // Generate each chunk
        for (let i = 0; i < config.chunks; i++) {
            const partNum = i + 1;
            const isFirstChunk = i === 0;

            console.log(`\n📝 Generating part ${partNum}/${config.chunks}...`);

            // Send progress update
            res.write(`data: ${JSON.stringify({
                type: 'progress',
                chunk: partNum,
                total: config.chunks,
                progress: Math.round((partNum / config.chunks) * 100)
            })}\n\n`);

            let prompt;
            
            if (isFirstChunk) {
                // First chunk - use full setup
                prompt = buildFirstChunkPrompt(
                    title, 
                    niche, 
                    tone, 
                    plot, 
                    styleExample, 
                    extraInstructions, 
                    config, 
                    partNum,
                    characterDetails
                );
            } else {
                // Continuation chunks - use context from previous
                const previousContext = extractCleanContext(chunks[i - 1]);
                
                // Update character tracker
                if (i === 1) {
                    characterTracker = extractCharacterInfo(chunks[0]);
                }
                
                prompt = buildContinuationPrompt(
                    title, 
                    niche, 
                    tone, 
                    previousContext, 
                    config, 
                    partNum,
                    characterTracker
                );
            }

            try {
                const apiKey = getNextApiKey();
                const chunk = await callGeminiAPI(prompt, apiKey);
                
                chunks.push(chunk);
                console.log(`✅ Part ${partNum} complete: ${chunk.length.toLocaleString()} characters`);

                // Send chunk data
                res.write(`data: ${JSON.stringify({
                    type: 'chunk',
                    chunk: partNum,
                    text: chunk,
                    chars: chunk.length
                })}\n\n`);

            } catch (error) {
                console.error(`❌ Error generating part ${partNum}:`, error.message);
                
                res.write(`data: ${JSON.stringify({
                    type: 'error',
                    chunk: partNum,
                    error: `Failed to generate part ${partNum}: ${error.message}`
                })}\n\n`);
                
                res.end();
                return;
            }
        }

        // Story complete
        const fullStory = chunks.join('\n\n');
        const wordCount = fullStory.split(/\s+/).length;
        
        console.log(`\n🎉 STREAMING COMPLETE!`);
        console.log(`📊 Final stats:`);
        console.log(`   - Total characters: ${fullStory.length.toLocaleString()}`);
        console.log(`   - Total words: ${wordCount.toLocaleString()}`);
        console.log(`   - Target achieved: ${fullStory.length >= targetLength * 0.95 ? '✅ YES' : '⚠️ NO'}`);

        // Send completion
        res.write(`data: ${JSON.stringify({
            type: 'complete',
            totalChars: fullStory.length,
            totalWords: wordCount,
            fullStory: fullStory,
            achieved: fullStory.length >= targetLength * 0.95
        })}\n\n`);

        res.end();

    } catch (error) {
        console.error('❌ Critical streaming error:', error.message);
        
        res.write(`data: ${JSON.stringify({
            type: 'error',
            error: error.message || 'Story generation failed'
        })}\n\n`);
        
        res.end();
    }
});

// 📝 NON-STREAMING ENDPOINT - Original compatibility version
app.post('/api/generate', async (req, res) => {
    try {
        const { 
            title, 
            niche, 
            tone, 
            plot, 
            styleExample, 
            extraInstructions, 
            targetLength = 60000,
            characterDetails 
        } = req.body;

        // Validation
        if (!title || !niche || !tone || !plot || !styleExample) {
            return res.status(400).json({ 
                error: 'Missing required fields: title, niche, tone, plot, styleExample',
                success: false 
            });
        }

        console.log(`\n🚀 Starting NON-STREAMING generation: "${title}"`);
        console.log(`📏 Target: ${targetLength.toLocaleString()} characters`);

        const config = getChunkConfig(targetLength);
        const chunks = [];
        let characterTracker = '';

        for (let i = 0; i < config.chunks; i++) {
            const partNum = i + 1;
            const isFirstChunk = i === 0;

            console.log(`📝 Generating part ${partNum}/${config.chunks}...`);

            let prompt;
            
            if (isFirstChunk) {
                prompt = buildFirstChunkPrompt(
                    title, 
                    niche, 
                    tone, 
                    plot, 
                    styleExample, 
                    extraInstructions, 
                    config, 
                    partNum,
                    characterDetails
                );
            } else {
                const previousContext = extractCleanContext(chunks[i - 1]);
                
                if (i === 1) {
                    characterTracker = extractCharacterInfo(chunks[0]);
                }
                
                prompt = buildContinuationPrompt(
                    title, 
                    niche, 
                    tone, 
                    previousContext, 
                    config, 
                    partNum,
                    characterTracker
                );
            }

            const apiKey = getNextApiKey();
            const chunk = await callGeminiAPI(prompt, apiKey);
            chunks.push(chunk);
            
            console.log(`✅ Part ${partNum} done: ${chunk.length.toLocaleString()} chars`);
        }

        const fullStory = chunks.join('\n\n');
        const wordCount = fullStory.split(/\s+/).length;

        console.log(`\n🎉 Generation complete!`);
        console.log(`   Characters: ${fullStory.length.toLocaleString()}`);
        console.log(`   Words: ${wordCount.toLocaleString()}`);

        res.json({
            success: true,
            script: fullStory,
            stats: {
                totalChars: fullStory.length,
                totalWords: wordCount,
                targetLength: targetLength,
                achieved: fullStory.length >= targetLength * 0.95,
                chunksGenerated: config.chunks
            }
        });

    } catch (error) {
        console.error('❌ Generation error:', error.message);
        res.status(500).json({
            error: error.message || 'Story generation failed',
            success: false
        });
    }
});

// 🏥 HEALTH CHECK ENDPOINT
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ready',
        service: 'AI Story Generator Ultimate',
        version: '2.0',
        apiKeys: apiKeys.length,
        features: [
            'Ultra-detailed prompts',
            'SSE real-time streaming', 
            'Auto story planning',
            'Character consistency tracking',
            'Professional prose quality',
            '5K-chunk perfect strategy'
        ],
        capabilities: {
            shortStories: '10K chars (2 chunks)',
            mediumStories: '30K chars (6 chunks)',
            longStories: '60K chars (12 chunks)',
            epicStories: '100K+ chars (20+ chunks)'
        },
        timestamp: new Date().toISOString()
    });
});

// 🏠 ROOT ENDPOINT
app.get('/', (req, res) => {
    res.json({
        service: 'AI Story Generator - ULTIMATE Edition',
        version: '2.0',
        status: 'running',
        apiKeys: apiKeys.length,
        description: 'Professional-grade AI story generation with ultra-detailed prompts and perfect chunking strategy',
        features: {
            autoGenerate: 'AI creates full story plan from title alone',
            streaming: 'Real-time SSE streaming with live progress',
            ultraPrompts: 'Award-winning prose quality prompts',
            characterTracking: 'Maintains consistency across all chunks',
            perfectChunking: '5500 chars per chunk using real API limits',
            qualityAssurance: 'Professional writing standards enforced'
        },
        endpoints: {
            autoGenerate: {
                path: '/api/auto-generate-details',
                method: 'POST',
                body: { title: 'string' },
                description: 'Generate complete story plan from title'
            },
            generateStream: {
                path: '/api/generate-stream',
                method: 'POST',
                body: {
                    title: 'string',
                    niche: 'string',
                    tone: 'string',
                    plot: 'string',
                    styleExample: 'string',
                    extraInstructions: 'string (optional)',
                    targetLength: 'number (default: 60000)',
                    characterDetails: 'string (optional)'
                },
                description: 'Stream story generation in real-time'
            },
            generate: {
                path: '/api/generate',
                method: 'POST',
                body: 'Same as generateStream',
                description: 'Generate complete story (non-streaming)'
            },
            health: {
                path: '/api/health',
                method: 'GET',
                description: 'Check API health and capabilities'
            }
        },
        documentation: {
            targetLengths: {
                '10000': '2 chunks (~2 minutes)',
                '30000': '6 chunks (~4 minutes)',
                '60000': '12 chunks (~8 minutes)',
                '100000': '20 chunks (~12 minutes)'
            },
            writingQuality: [
                'Sensory immersion (3+ senses per scene)',
                'Deep character POV',
                'Natural dialogue with subtext',
                'Show don\'t tell',
                'Varied pacing',
                'Professional prose',
                'Character consistency',
                'Plot coherence'
            ]
        }
    });
});

// 🎯 ERROR HANDLING MIDDLEWARE
app.use((error, req, res, next) => {
    console.error('❌ Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message,
        success: false
    });
});

// 🚀 START SERVER
app.listen(PORT, () => {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🚀 AI STORY GENERATOR ULTIMATE - Backend Server');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`\n✅ Server running on port ${PORT}`);
    console.log(`✅ API Keys loaded: ${apiKeys.length}`);
    console.log(`✅ Gemini Model: gemini-2.0-flash-exp`);
    console.log(`✅ Max output per chunk: 8,192 tokens (~5,500 chars)`);
    console.log('\n🎨 FEATURES ENABLED:');
    console.log('   ✓ Ultra-detailed story prompts');
    console.log('   ✓ Professional prose quality enforcement');
    console.log('   ✓ SSE real-time streaming');
    console.log('   ✓ Auto story planning from title');
    console.log('   ✓ Character consistency tracking');
    console.log('   ✓ Perfect 5K-chunk strategy');
    console.log('   ✓ Story arc progression system');
    console.log('   ✓ Sensory immersion requirements');
    console.log('   ✓ Show-don\'t-tell enforcement');
    console.log('   ✓ Deep POV and dialogue mastery');
    console.log('\n📊 STORY CAPABILITIES:');
    console.log('   • Short (10K): 2 chunks in ~2 minutes');
    console.log('   • Medium (30K): 6 chunks in ~4 minutes');
    console.log('   • Long (60K): 12 chunks in ~8 minutes');
    console.log('   • Epic (100K+): 20+ chunks in ~12 minutes');
    console.log('\n🔧 API ENDPOINTS:');
    console.log(`   POST ${PORT === 3000 ? 'http://localhost:3000' : ''}/api/auto-generate-details`);
    console.log(`   POST ${PORT === 3000 ? 'http://localhost:3000' : ''}/api/generate-stream`);
    console.log(`   POST ${PORT === 3000 ? 'http://localhost:3000' : ''}/api/generate`);
    console.log(`   GET  ${PORT === 3000 ? 'http://localhost:3000' : ''}/api/health`);
    console.log('\n⚡ Ready for production story generation!');
    console.log('═══════════════════════════════════════════════════════════\n');
});
