import type { Messages } from './en';

// TODO(native review): Hindi strings written by a non-native speaker. Check wording and tone
// with a Hindi-speaking solar technician before release.
const hi: Messages = {
  ui: {
    close: 'बंद करें',
    loading: 'लोड हो रहा है',
    retry: 'फिर से कोशिश करें',
    dismiss: 'हटाएं',
    remove: 'हटाएं',
    optional: 'वैकल्पिक',
    required: 'ज़रूरी',
    language: 'भाषा',
    error: {
      title: 'कुछ गलत हो गया',
      code: 'त्रुटि कोड: {{code}}',
    },
    table: {
      sortBy: '{{column}} के अनुसार क्रमबद्ध करें',
      sortedAscending: 'बढ़ते क्रम में',
      sortedDescending: 'घटते क्रम में',
      selectAll: 'सभी पंक्तियाँ चुनें',
      selectRow: '{{id}} चुनें',
      selectedCount: '{{count}} चुने गए',
    },
    stepper: {
      label: 'प्रगति',
      stepOf: 'चरण {{current}} / {{total}}',
      completed: 'पूर्ण',
      current: 'वर्तमान चरण',
    },
    upload: {
      dragHere: 'फ़ोटो यहाँ खींचकर छोड़ें',
      browse: 'फ़ाइलें चुनें',
      takePhoto: 'फ़ोटो लें',
      limit: 'अधिकतम {{count}} फ़ोटो, JPG या PNG, हर एक {{size}} MB तक',
      removePhoto: '{{name}} हटाएं',
      tooMany: 'आप अधिकतम {{count}} फ़ोटो जोड़ सकते हैं।',
      wrongType: '{{name}} कोई छवि नहीं है।',
      tooLarge: '{{name}} {{size}} MB से बड़ी है।',
      uploading: 'अपलोड हो रहा है',
      failed: 'अपलोड विफल रहा',
    },
    camera: {
      title: 'फ़ोटो लें',
      capture: 'कैप्चर करें',
      retake: 'फिर से लें',
      usePhoto: 'यह फ़ोटो इस्तेमाल करें',
      starting: 'कैमरा शुरू हो रहा है',
      denied: 'कैमरा की अनुमति नहीं मिली। ब्राउज़र सेटिंग में अनुमति दें, या फ़ोटो अपलोड करें।',
      unavailable: 'इस डिवाइस पर कैमरा नहीं मिला। फ़ोटो अपलोड करें।',
      uploadInstead: 'फ़ोटो अपलोड करें',
    },
    source: {
      measured: 'मापा गया',
      extracted: 'निकाला गया',
      entered: 'आपने दर्ज किया',
      simulated: 'सिम्युलेटेड',
      assumption: 'अनुमान',
      sourced: 'स्रोत सहित',
      sourceLabel: 'स्रोत',
      showSource: 'स्रोत देखें: {{label}}',
    },
    decision: {
      repair: 'मरम्मत',
      reuse: 'पुनः उपयोग',
      recycle: 'रीसायकल',
    },
    confidence: {
      low: 'न्यूनतम',
      expected: 'अपेक्षित',
      high: 'अधिकतम',
      summary: '{{label}}: अपेक्षित {{expected}}, सीमा {{low}} से {{high}}',
    },
  },
};

export default hi;
