import { defineBundledChannelEntry } from 'openclaw/plugin-sdk/channel-entry-contract';

export default defineBundledChannelEntry({
  id: 'lyfestack',
  name: 'LyfeStack',
  description: 'LyfeStack channel plugin',
  importMetaUrl: import.meta.url,
  plugin: {
    specifier: './channel-plugin-api.js',
    exportName: 'lyfestackPlugin',
  },
});
