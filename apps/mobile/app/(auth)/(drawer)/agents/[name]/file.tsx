import { useState, useEffect } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { MarkdownEditorModal } from '../../../../../components/ui/MarkdownEditorModal';
import { openclawApi } from '../../../../../services/openclaw.api';

export default function AgentFileScreen() {
  const { name, filename } = useLocalSearchParams<{ name: string; filename: string }>();

  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!filename) return;
    openclawApi.getAgentFile(name, filename)
      .then((res: any) => setContent(res.data.content))
      .finally(() => setLoading(false));
  }, [name, filename]);

  const handleSave = async (updated: string) => {
    setSaving(true);
    try {
      await openclawApi.updateAgentFile(name, filename, updated);
      setContent(updated);
    } finally {
      setSaving(false);
    }
  };

  return (
    <MarkdownEditorModal
      visible
      title={filename}
      initialContent={content}
      loading={loading}
      saving={saving}
      onSave={handleSave}
      onClose={() => router.back()}
    />
  );
}
