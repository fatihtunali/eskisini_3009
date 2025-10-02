require('dotenv/config');
const OpenAI = require('openai');

// Initialize OpenAI only if API key exists
let openai = null;
console.log('Checking OpenAI API Key:', process.env.OPENAI_API_KEY ? 'Found' : 'Not found');

if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here') {
  try {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log('✅ OpenAI initialized with API key');
  } catch (error) {
    console.error('❌ OpenAI initialization failed:', error.message);
  }
} else {
  console.log('⚠️ OpenAI API key not found or invalid, using fallback moderation');
}

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

async function moderateContent(title, description) {
  if (!openai) {
    console.log('OpenAI not available, using fallback moderation');
    return fallbackModeration(title, description);
  }

  try {
    const content = `Başlık: ${title}\nAçıklama: ${description}`;

    // First use OpenAI's moderation endpoint
    const moderation = await openai.moderations.create({
      input: content,
    });

    const moderationResult = moderation.results[0];
    let riskLevel = 'low';
    let aiSuggestion = 'approve';
    let flagReason = '';
    const flaggedCategories = [];

    // Check moderation flags
    if (moderationResult.flagged) {
      const categories = moderationResult.categories;

      if (categories.violence || categories.violence_graphic || categories.weapons) {
        flaggedCategories.push('Şiddet/Silah');
        riskLevel = 'high';
        aiSuggestion = 'reject';
      }

      if (categories.illegal || categories.drugs) {
        flaggedCategories.push('Yasadışı/Uyuşturucu');
        riskLevel = 'high';
        aiSuggestion = 'reject';
      }

      if (categories.sexual || categories.sexual_minors) {
        flaggedCategories.push('Cinsel İçerik');
        riskLevel = 'high';
        aiSuggestion = 'reject';
      }

      if (categories.harassment || categories.harassment_threatening) {
        flaggedCategories.push('Taciz/Tehdit');
        riskLevel = 'high';
        aiSuggestion = 'reject';
      }

      if (categories.hate || categories.hate_threatening) {
        flaggedCategories.push('Nefret Söylemi');
        riskLevel = 'high';
        aiSuggestion = 'reject';
      }

      if (categories.self_harm) {
        flaggedCategories.push('Kendine Zarar');
        riskLevel = 'high';
        aiSuggestion = 'reject';
      }

      flagReason = `OpenAI Moderation tespit etti: ${flaggedCategories.join(', ')}`;
    }

    // If passed moderation, do additional contextual analysis
    if (!moderationResult.flagged || riskLevel === 'low') {
      const analysisPrompt = `
Sen bir Türk ikinci el alışveriş sitesi için içerik moderatörüsün. Bu ilan içeriğini analiz et:

Başlık: "${title}"
Açıklama: "${description}"

Aşağıdaki kriterlere göre değerlendir:
1. Yasak ürünler: Silah, uyuşturucu, sahte ürün, çalıntı mal
2. Dolandırıcılık: Hızlı para, garanti kazanç, MLM, piramit
3. Uygunsuz satış: Diploma, kimlik, organ, kan
4. Spam/Reklam: Aşırı tanıtım, telefon/WhatsApp isteme

JSON formatında yanıtla:
{
  "riskLevel": "low|medium|high",
  "aiSuggestion": "approve|review|reject",
  "flagReason": "açıklama",
  "concerns": ["tespit edilen sorunlar"],
  "confidence": 0.0-1.0
}`;

      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'Sen profesyonel bir içerik moderatörüsün. Türkiye yasalarına ve e-ticaret kurallarına göre değerlendirme yapıyorsun.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        temperature: 0.1,
        max_tokens: 300,
      });

      try {
        let responseContent = completion.choices[0].message.content;

        // Clean up markdown formatting
        responseContent = responseContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

        console.log('OpenAI raw response:', responseContent);

        const analysis = JSON.parse(responseContent);

        // Merge OpenAI moderation with contextual analysis
        if (analysis.riskLevel === 'high' || (analysis.riskLevel === 'medium' && analysis.confidence > 0.7)) {
          riskLevel = analysis.riskLevel;
          aiSuggestion = analysis.aiSuggestion;
          flagReason = flagReason ? `${flagReason} | ${analysis.flagReason}` : analysis.flagReason;
        }

        return {
          riskLevel,
          aiSuggestion,
          flagReason: flagReason || analysis.flagReason || 'İçerik temiz görünüyor',
          flaggedKeywords: flaggedCategories.concat(analysis.concerns || []),
          suspiciousMatches: [],
          confidence: analysis.confidence || 0.8,
          source: 'openai'
        };

      } catch (parseError) {
        console.error('OpenAI response parse error:', parseError);
        console.log('Failed to parse:', completion.choices[0].message.content);
        return fallbackModeration(title, description);
      }
    }

    return {
      riskLevel,
      aiSuggestion,
      flagReason,
      flaggedKeywords: flaggedCategories,
      suspiciousMatches: [],
      confidence: 0.9,
      source: 'openai-moderation'
    };

  } catch (error) {
    console.error('OpenAI moderation error:', error);
    return fallbackModeration(title, description);
  }
}

function fallbackModeration(title, description) {
  const content = `${title}\n${description}`.toLowerCase();

  const prohibitedKeywords = [
    'silah', 'tabanca', 'tüfek', 'bomba', 'patlayıcı',
    'uyuşturucu', 'esrar', 'kokain', 'eroin', 'mdma', 'lsd',
    'sahte', 'çalıntı', 'hırsızlık', 'dolandırıcılık',
    'cinsel', 'porno', 'escort', 'seks',
    'kumar', 'bahis', 'illegal', 'kaçak',
    'organ', 'böbrek', 'kan', 'plazma',
    'diploma', 'sertifika sahte', 'kimlik',
    'kredi kartı', 'banka bilgi', 'hesap bilgi'
  ];

  const suspiciousPhrases = [
    'hızlı para', 'kolay kazanç', 'riske girmeden',
    'garanti kazanç', 'günlük kazanç', 'pasif gelir',
    'MLM', 'piramit', 'zincir mektup'
  ];

  const flaggedKeywords = prohibitedKeywords.filter(keyword => content.includes(keyword));
  const suspiciousMatches = suspiciousPhrases.filter(phrase => content.includes(phrase));

  let riskLevel = 'low';
  let aiSuggestion = 'approve';
  let flagReason = '';

  if (flaggedKeywords.length > 0) {
    riskLevel = flaggedKeywords.length > 2 ? 'high' : 'medium';
    aiSuggestion = 'reject';
    flagReason = `Yasak içerik: ${flaggedKeywords.join(', ')}`;
  }

  if (suspiciousMatches.length > 2) {
    riskLevel = riskLevel === 'low' ? 'medium' : 'high';
    if (aiSuggestion === 'approve') aiSuggestion = 'review';
    flagReason += (flagReason ? ' | ' : '') + `Şüpheli ifadeler: ${suspiciousMatches.join(', ')}`;
  }

  return {
    riskLevel,
    aiSuggestion,
    flagReason: flagReason || 'İçerik temiz görünüyor',
    flaggedKeywords,
    suspiciousMatches,
    confidence: 0.6,
    source: 'fallback'
  };
}

module.exports = {
  moderateContent
};