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

// 🎯 THE WINNING STRATEGY: Smart chunk configuration
function getChunkConfig(targetLength) {
    // FEWER chunks, BIGGER sizes = BETTER results!
    if (targetLength <= 15000) {
        return { chunks: 2, charsPerChunk: 6000 };   // 12K+ result
    } else if (targetLength <= 35000) {
        return { chunks: 2, charsPerChunk: 15000 };  // 30-35K result
    } else if (targetLength <= 65000) {
        return { chunks: 3, charsPerChunk: 20000 };  // 60-70K result
    } else if (targetLength <= 85000) {
        return { chunks: 3, charsPerChunk: 25000 };  // 75-85K result
    } else {
        return { chunks: 3, charsPerChunk: 35000 };  // 105-120K result
    }
}

// 🎯 Story arc structure per chunk
function getSectionGoal(partNum, totalParts) {
    const progress = partNum / totalParts;
    
    if (progress <= 0.33) {
        return 'OPENING: Explosive arrival, first encounters, initial combat/tension';
    }
    if (progress <= 0.67) {
        return 'ESCALATION: Major confrontations, rising stakes, deeper conflict';
    }
    return 'CLIMAX & RESOLUTION: Ultimate showdown, satisfying conclusion';
}

// 🎯 Build prompts with AGGRESSIVE length enforcement
function buildFirstChunkPrompt(title, niche, tone, plot, styleExample, extraInstructions, config, partNum) {
    const sectionGoal = getSectionGoal(partNum, config.chunks);
    
    return `You are a professional story writer creating a ${niche} story.

🎯 TARGET: ${config.charsPerChunk.toLocaleString()} characters (Chunk ${partNum} of ${config.chunks})

**STORY SETUP:**
- Title: "${title}"
- Genre: ${niche}
- Tone: ${tone}
- Plot: ${plot}
- Writing Style: ${styleExample}
${extraInstructions ? `- Extra Instructions: ${extraInstructions}` : ''}

**THIS CHUNK'S GOAL:**
${sectionGoal}

**CRITICAL REQUIREMENTS:**
✅ WRITE EXACTLY ${config.charsPerChunk.toLocaleString()} CHARACTERS - be EXTREMELY detailed!
✅ Rich, vivid descriptions of every scene
✅ Deep character thoughts and emotions
✅ Detailed action sequences
✅ Elaborate dialogue with context
✅ Every scene fully developed, not rushed
✅ Character names STAY CONSISTENT (once chosen, NEVER change)

**WRITE THE STORY NOW (${config.charsPerChunk.toLocaleString()} characters):**`;
}

function buildContinuationPrompt(title, niche, tone, previousContext, config, partNum) {
    const sectionGoal = getSectionGoal(partNum, config.chunks);
    const isLastChunk = partNum === config.chunks;
    
    let prompt = `Continue SEAMLESSLY from previous chunk. Chunk ${partNum} of ${config.chunks}.

🎯 TARGET: EXACTLY ${config.charsPerChunk.toLocaleString()} characters for this chunk.

**PREVIOUS CONTEXT:**
${previousContext}

**CRITICAL: Continue EXACTLY where previous ended. NO recaps. NO reintroductions.**

**SEAMLESS CONTINUATION RULES:**
✅ Continue mid-sentence if previous ended in action
✅ EXACT same character names (NO CHANGES EVER!)
✅ Same personality, powers, and fighting style
✅ Same writing style and tone
✅ Reference previous events naturally without recap

**THIS CHUNK'S GOAL:**
${sectionGoal}

`;

    if (isLastChunk) {
        prompt += `🔥 THIS IS THE FINAL CHUNK - Complete the story with satisfying, epic ending!

**ENDING REQUIREMENTS (FINAL CHUNK):**
✅ Resolve ALL story threads
✅ Epic climax with detailed combat/confrontation
✅ Clear aftermath and consequences
✅ Character reflection on journey
✅ Satisfying closing moment
✅ Strong final line that resonates

`;
    }

    prompt += `**WRITE EXACTLY ${config.charsPerChunk.toLocaleString()} CHARACTERS with maximum detail!**

Continue the ${niche} story NOW:`;

    return prompt;
}

// 🎯 Extract clean context (sentence-aware, NO raw slicing!)
function extractCleanContext(text) {
    if (!text || text.length < 100) return text;
    
    // Split into complete sentences
    const sentences = text
        .split(/[.!?]/)
        .filter(s => s.trim().length > 20)
        .slice(-8)  // Last 8 substantial sentences
        .join('. ') + '.';
    
    return sentences;
}

// 🎯 Call Gemini 2.5 Flash with MAXIMUM output tokens
async function callGeminiAPI(prompt, apiKey, maxRetries = 3) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await axios.post(url, {
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.95,      // High creativity
                    topP: 0.95,
                    topK: 64,
                    maxOutputTokens: 65536  // MAXIMUM for Gemini 2.5 Flash!
                }
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 180000  // 3 minutes for big chunks
            });

            if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                return response.data.candidates[0].content.parts[0].text;
            }
            throw new Error('Invalid response format');
        } catch (error) {
            console.error(`Attempt ${attempt + 1} failed:`, error.message);
            
            if (attempt === maxRetries - 1) throw error;
            
            if (error.response?.status === 429 || error.code === 'ECONNABORTED') {
                const waitTime = 3000 * (attempt + 1);
                console.log(`Waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
                throw error;
            }
        }
    }
}

// 🎯 Generate story with WINNING STRATEGY (NO review system!)
async function generateStoryWithWinningStrategy(title, niche, tone, plot, styleExample, extraInstructions, targetLength) {
    const config = getChunkConfig(targetLength);
    const chunks = [];
    
    console.log(`\n🎯 STRATEGY: ${config.chunks} chunks × ${config.charsPerChunk.toLocaleString()} chars each`);
    console.log(`📊 Expected result: ${(config.chunks * config.charsPerChunk * 0.9).toLocaleString()}-${(config.chunks * config.charsPerChunk * 1.1).toLocaleString()} characters\n`);
    
    for (let i = 0; i < config.chunks; i++) {
        const partNum = i + 1;
        const isFirstChunk = i === 0;
        
        console.log(`📝 Generating chunk ${partNum}/${config.chunks}...`);
        
        let prompt;
        if (isFirstChunk) {
            prompt = buildFirstChunkPrompt(title, niche, tone, plot, styleExample, extraInstructions, config, partNum);
        } else {
            const previousContext = extractCleanContext(chunks[i - 1]);
            prompt = buildContinuationPrompt(title, niche, tone, previousContext, config, partNum);
        }
        
        const apiKey = getNextApiKey();
        const chunk = await callGeminiAPI(prompt, apiKey);
        
        chunks.push(chunk);
        console.log(`✅ Chunk ${partNum} generated: ${chunk.length.toLocaleString()} characters`);
    }
    
    const fullStory = chunks.join('\n\n');
    console.log(`\n🎉 FINAL STORY: ${fullStory.length.toLocaleString()} characters`);
    
    return fullStory;
}

// Main generation endpoint (NO REVIEW SYSTEM!)
app.post('/api/generate', async (req, res) => {
    try {
        const { title, niche, tone, plot, styleExample, extraInstructions, targetLength = 60000 } = req.body;

        if (!title || !niche || !tone || !plot || !styleExample) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        console.log(`\n🚀 Starting generation: "${title}"`);
        console.log(`📏 Target length: ${targetLength.toLocaleString()} characters`);
        
        // Single-pass generation with winning strategy!
        const story = await generateStoryWithWinningStrategy(
            title, niche, tone, plot, styleExample, extraInstructions, targetLength
        );

        const stats = {
            totalChars: story.length,
            totalWords: story.split(/\s+/).length,
            targetLength,
            achieved: story.length >= targetLength
        };

        res.json({
            success: true,
            script: story,
            stats,
            method: 'winning_strategy_no_review'
        });

    } catch (error) {
        console.error('❌ Generation error:', error);
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
        strategy: 'winning_chunks',
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.json({
        service: 'AI Story Generator Backend (Winning Strategy)',
        status: 'running',
        apiKeys: apiKeys.length,
        strategy: 'Fewer chunks + Bigger sizes + No review = Quality + Length ✅',
        endpoints: {
            generate: '/api/generate',
            health: '/api/health'
        }
    });
});

app.listen(PORT, () => {
    console.log(`\n✅ Server running on port ${PORT}`);
    console.log(`✅ API Keys loaded: ${apiKeys.length}`);
    console.log(`🎯 Strategy: WINNING (fewer chunks, bigger sizes, no review)`);
    console.log(`🚀 Using Gemini 2.0 Flash with 65K max tokens\n`);
});
