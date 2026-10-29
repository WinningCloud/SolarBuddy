const en = {
  ui: {
    close: 'Close',
    loading: 'Loading',
    retry: 'Try again',
    dismiss: 'Dismiss',
    remove: 'Remove',
    optional: 'Optional',
    required: 'Required',
    language: 'Language',
    error: {
      title: 'Something went wrong',
      code: 'Error code: {{code}}',
    },
    table: {
      sortBy: 'Sort by {{column}}',
      sortedAscending: 'sorted ascending',
      sortedDescending: 'sorted descending',
      selectAll: 'Select all rows',
      selectRow: 'Select {{id}}',
      selectedCount: '{{count}} selected',
    },
    stepper: {
      label: 'Progress',
      stepOf: 'Step {{current}} of {{total}}',
      completed: 'Completed',
      current: 'Current step',
    },
    upload: {
      dragHere: 'Drag a photo here',
      browse: 'Browse files',
      takePhoto: 'Take photo',
      limit: 'Up to {{count}} photos, JPG or PNG, {{size}} MB each',
      removePhoto: 'Remove {{name}}',
      tooMany: 'You can add up to {{count}} photos.',
      wrongType: '{{name}} is not an image.',
      tooLarge: '{{name}} is larger than {{size}} MB.',
      uploading: 'Uploading',
      failed: 'Upload failed',
    },
    camera: {
      title: 'Take a photo',
      capture: 'Capture',
      retake: 'Retake',
      usePhoto: 'Use photo',
      starting: 'Starting camera',
      denied:
        'Camera access was blocked. Allow camera access in your browser settings, or upload a photo instead.',
      unavailable: 'No camera found on this device. Upload a photo instead.',
      uploadInstead: 'Upload a photo instead',
    },
    source: {
      measured: 'Measured',
      extracted: 'Extracted',
      entered: 'Entered by you',
      simulated: 'Simulated',
      assumption: 'Assumption',
      sourced: 'Sourced',
      sourceLabel: 'Source',
      showSource: 'Show source: {{label}}',
    },
    decision: {
      repair: 'Repair',
      reuse: 'Reuse',
      recycle: 'Recycle',
    },
    confidence: {
      low: 'Low',
      expected: 'Expected',
      high: 'High',
      summary: '{{label}}: expected {{expected}}, range {{low}} to {{high}}',
    },
  },
};

export default en;
export type Messages = typeof en;
