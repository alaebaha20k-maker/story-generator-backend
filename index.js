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

// Enhanced prompts with quality control
function buildStoryPrompt(title, niche, tone, plot, styleExample, extraInstructions, targetLength) {
    return `You are a professional story writer. Create a HIGH-QUALITY, CONSISTENT story with NO ERRORS.

**CRITICAL RULES - FOLLOW EXACTLY:**
1. **CHARACTER NAMES:** Once you choose a character's name, NEVER change it. Use the SAME name throughout the entire story.
2. **NO REPETITION:** Never repeat the same paragraph or sentence twice.
3. **CONSISTENCY:** Keep all details (names, places, events) consistent throughout.
4. **PACING:** Develop relationships and plot points gradually, not rushed.
5. **ORIGINALITY:** Avoid clichés. Create unexpected twists and unique solutions.
6. **CHARACTER DEPTH:** Show character emotions and motivations through actions and thoughts.

**STORY REQUIREMENTS:**
- Title: "${title}"
- Genre: ${niche}
- Tone: ${tone}
- Plot: ${plot}
- Target Length: ${targetLength} characters (write until you reach this length naturally)
- Style: Match this writing style exactly:
${styleExample}

${extraInstructions ? `Additional Instructions: ${extraInstructions}` : ''}

**QUALITY CHECKLIST (verify before finishing):**
✓ Character names stay consistent
✓ No repeated paragraphs
✓ Relationships develop naturally over time
✓ Plot twists are surprising but logical
✓ Emotional depth in character decisions
✓ Vivid, unique descriptions (no generic phrases)
✓ Proper story structure: Setup → Conflict → Climax → Resolution

**NOW WRITE THE COMPLETE STORY:**`;
}

function buildReviewPrompt(story, title, niche) {
    return `You are a professional story editor. Review this ${niche} story titled "${title}" and identify ALL errors and weaknesses.

**CHECK FOR:**
1. Character name inconsistencies (did names change?)
2. Repeated paragraphs or sentences
3. Rushed character development or relationships
4. Plot holes or logical inconsistencies
5. Cliché or predictable elements
6. Weak emotional depth
7. Poor pacing issues

**STORY TO REVIEW:**
${story}

**PROVIDE:**
1. List of specific errors found (with line references if possible)
2. Quality score (1-10)
3. Specific suggestions for improvement

Format your response as:
ERRORS:
[list each error]

SCORE: [1-10]

SUGGESTIONS:
[specific improvements needed]`;
}

function buildFixPrompt(story, reviewFeedback, title, niche, tone) {
    return `You are a professional story editor. Fix this story based on the review feedback.

**ORIGINAL STORY:**
${story}

**REVIEW FEEDBACK:**
${reviewFeedback}

**YOUR TASK:**
Fix ALL identified errors while maintaining the story's essence. Specifically:
1. Fix any character name inconsistencies (choose ONE name and use it throughout)
2. Remove any repeated paragraphs or text
3. Develop rushed relationships more naturally (add scenes, internal thoughts)
4. Replace clichés with original ideas
5. Add emotional depth to character decisions
6. Improve pacing where needed
7. Keep the ${tone} tone and ${niche} genre

**CRITICAL:** Return ONLY the complete fixed story. No explanations, no notes, just the story text.

**WRITE THE COMPLETE FIXED STORY NOW:**`;
}

async function callGeminiAPI(prompt, apiKey, maxRetries = 3) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await axios.post(url, {
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.9,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 8192,
                }
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 120000
            });

            if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                return response.data.candidates[0].content.parts[0].text;
            }
            throw new Error('Invalid response format');
        } catch (error) {
            if (attempt === maxRetries - 1) throw error;
            if (error.response?.status === 429) {
                await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
            } else {
                throw error;
            }
        }
    }
}

async function generateStoryInChunks(title, niche, tone, plot, styleExample, extraInstructions, targetLength) {
    const chunkSize = Math.min(30000, targetLength);
    const numChunks = Math.ceil(targetLength / chunkSize);
    let fullStory = '';
    let previousContext = '';

    for (let i = 0; i < numChunks; i++) {
        const isFirstChunk = i === 0;
        const isLastChunk = i === numChunks - 1;
        
        let chunkPrompt;
        if (isFirstChunk) {
            chunkPrompt = buildStoryPrompt(title, niche, tone, plot, styleExample, extraInstructions, chunkSize);
        } else {
            chunkPrompt = `Continue this ${niche} story. Maintain consistency with previous part.

**PREVIOUS CONTEXT:**
${previousContext}

**CONTINUE THE STORY (write ${chunkSize} more characters):**
- Keep the SAME character names
- Maintain the ${tone} tone
- ${isLastChunk ? 'BRING THE STORY TO A SATISFYING CONCLUSION' : 'Continue building tension and development'}

Write naturally and seamlessly from where it left off:`;
        }

        const apiKey = getNextApiKey();
        const chunk = await callGeminiAPI(chunkPrompt, apiKey);
        fullStory += chunk;
        previousContext = chunk.slice(-2000);

        if (fullStory.length >= targetLength && !isLastChunk) break;
    }

    return fullStory;
}

// Main generation endpoint with review system
app.post('/api/generate', async (req, res) => {
    try {
        const { title, niche, tone, plot, styleExample, extraInstructions, targetLength = 60000 } = req.body;

        if (!title || !niche || !tone || !plot || !styleExample) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        console.log(`[STEP 1] Generating initial story: ${title}`);
        
        // Step 1: Generate story
        let story = await generateStoryInChunks(
            title, niche, tone, plot, styleExample, extraInstructions, targetLength
        );

        console.log(`[STEP 2] Reviewing story quality...`);
        
        // Step 2: Review the story
        const reviewPrompt = buildReviewPrompt(story, title, niche);
        const apiKey = getNextApiKey();
        const reviewFeedback = await callGeminiAPI(reviewPrompt, apiKey);

        console.log(`[REVIEW FEEDBACK]:\n${reviewFeedback.substring(0, 500)}...`);

        // Step 3: Check if fixes are needed
        const needsFix = reviewFeedback.includes('ERRORS:') && 
                        !reviewFeedback.includes('ERRORS:\nNone') &&
                        !reviewFeedback.includes('ERRORS: None');

        if (needsFix) {
            console.log(`[STEP 3] Errors found, fixing story...`);
            
            // Fix the story
            const fixPrompt = buildFixPrompt(story, reviewFeedback, title, niche, tone);
            const fixApiKey = getNextApiKey();
            story = await callGeminiAPI(fixPrompt, fixApiKey);
            
            console.log(`[STEP 3] Story fixed successfully!`);
        } else {
            console.log(`[STEP 3] No errors found, story is good!`);
        }

        // Calculate stats
        const stats = {
            totalChars: story.length,
            totalWords: story.split(/\s+/).length,
            chunks: Math.ceil(targetLength / 30000)
        };

        res.json({
            success: true,
            script: story,
            stats,
            reviewPerformed: true,
            errorsFixed: needsFix
        });

    } catch (error) {
        console.error('Generation error:', error);
        res.status(500).json({
            error: error.message || 'Failed to generate story',
            success: false
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ready',
        apiKeys: apiKeys.length,
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.json({
        service: 'AI Story Generator Backend',
        status: 'running',
        apiKeys: apiKeys.length,
        endpoints: {
            generate: '/api/generate',
            health: '/api/health'
        }
    });
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ API Keys loaded: ${apiKeys.length}`);
});
