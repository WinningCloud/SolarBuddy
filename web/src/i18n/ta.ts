import type { Messages } from './en';

// TODO(native review): Tamil strings written by a non-native speaker. Check wording and tone
// with a Tamil-speaking solar technician before release.
const ta: Messages = {
  ui: {
    close: 'மூடு',
    loading: 'ஏற்றுகிறது',
    retry: 'மீண்டும் முயற்சிக்கவும்',
    dismiss: 'மறை',
    remove: 'நீக்கு',
    optional: 'விருப்பத்தேர்வு',
    required: 'கட்டாயம்',
    language: 'மொழி',
    error: {
      title: 'ஏதோ தவறு நடந்துவிட்டது',
      code: 'பிழைக் குறியீடு: {{code}}',
    },
    table: {
      sortBy: '{{column}} படி வரிசைப்படுத்து',
      sortedAscending: 'ஏறுவரிசையில்',
      sortedDescending: 'இறங்குவரிசையில்',
      selectAll: 'அனைத்து வரிசைகளையும் தேர்ந்தெடு',
      selectRow: '{{id}} ஐத் தேர்ந்தெடு',
      selectedCount: '{{count}} தேர்ந்தெடுக்கப்பட்டன',
    },
    stepper: {
      label: 'முன்னேற்றம்',
      stepOf: 'படி {{current}} / {{total}}',
      completed: 'முடிந்தது',
      current: 'தற்போதைய படி',
    },
    upload: {
      dragHere: 'புகைப்படத்தை இங்கே இழுத்து விடவும்',
      browse: 'கோப்புகளைத் தேர்ந்தெடு',
      takePhoto: 'புகைப்படம் எடு',
      limit: 'அதிகபட்சம் {{count}} புகைப்படங்கள், JPG அல்லது PNG, ஒவ்வொன்றும் {{size}} MB',
      removePhoto: '{{name}} ஐ நீக்கு',
      tooMany: 'அதிகபட்சம் {{count}} புகைப்படங்களைச் சேர்க்கலாம்.',
      wrongType: '{{name}} ஒரு படம் அல்ல.',
      tooLarge: '{{name}} {{size}} MB-ஐ விடப் பெரியது.',
      uploading: 'பதிவேற்றுகிறது',
      failed: 'பதிவேற்றம் தோல்வியடைந்தது',
    },
    camera: {
      title: 'புகைப்படம் எடுக்கவும்',
      capture: 'படம் பிடி',
      retake: 'மீண்டும் எடு',
      usePhoto: 'இந்தப் புகைப்படத்தைப் பயன்படுத்து',
      starting: 'கேமரா தொடங்குகிறது',
      denied:
        'கேமரா அணுகல் தடுக்கப்பட்டது. உலாவி அமைப்புகளில் அனுமதிக்கவும், அல்லது புகைப்படத்தைப் பதிவேற்றவும்.',
      unavailable: 'இந்தச் சாதனத்தில் கேமரா இல்லை. புகைப்படத்தைப் பதிவேற்றவும்.',
      uploadInstead: 'புகைப்படத்தைப் பதிவேற்றவும்',
    },
    source: {
      measured: 'அளவிடப்பட்டது',
      extracted: 'பிரித்தெடுக்கப்பட்டது',
      entered: 'நீங்கள் உள்ளிட்டது',
      simulated: 'உருவகப்படுத்தப்பட்டது',
      assumption: 'அனுமானம்',
      sourced: 'ஆதாரத்துடன்',
      sourceLabel: 'ஆதாரம்',
      showSource: 'ஆதாரத்தைக் காட்டு: {{label}}',
    },
    decision: {
      repair: 'பழுதுபார்',
      reuse: 'மறுபயன்பாடு',
      recycle: 'மறுசுழற்சி',
    },
    confidence: {
      low: 'குறைந்தபட்சம்',
      expected: 'எதிர்பார்ப்பு',
      high: 'அதிகபட்சம்',
      summary: '{{label}}: எதிர்பார்ப்பு {{expected}}, வரம்பு {{low}} முதல் {{high}} வரை',
    },
  },
};

export default ta;
