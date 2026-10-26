import { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import {
  Text,
  ActivityIndicator,
  SegmentedButtons,
  Portal,
  Modal,
  Button,
  Divider,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useImportedFiles, uploadImportFile } from '../../../src/api/imports';
import { useAuth } from '../../../src/hooks/useAuth';
import type { ImportedFile, ImportSourceType } from '../../../src/types/models';
import { Screen } from '../../../src/components/layout/Screen';
import { Panel } from '../../../src/components/layout/StatCard';
import { Tag, type TagTone } from '../../../src/components/layout/Tag';
import { palette, spacing } from '../../../src/theme';

const STATUS_LABELS: Record<ImportedFile['status'], string> = {
  uploaded: 'הועלה',
  parsing: 'בתהליך ניתוח',
  parsed: 'נותח בהצלחה',
  failed: 'נכשל',
};

const STATUS_TONE: Record<ImportedFile['status'], TagTone> = {
  uploaded: 'neutral',
  parsing: 'warn',
  parsed: 'in',
  failed: 'out',
};

const sourceOptions: { value: ImportSourceType; label: string }[] = [
  { value: 'bankCsv', label: 'דוח בנק (CSV)' },
  { value: 'creditCardCsv', label: 'דוח אשראי (CSV)' },
  { value: 'excel', label: 'קובץ Excel' },
];

export default function ImportList() {
  const { files, loading } = useImportedFiles();
  const { firebaseUid } = useAuth();
  const router = useRouter();

  const [modalVisible, setModalVisible] = useState(false);
  const [sourceType, setSourceType] = useState<ImportSourceType>('bankCsv');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPickAndUpload = async () => {
    if (!firebaseUid) return;
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setUploading(true);
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      await uploadImportFile({
        blob,
        fileName: asset.name,
        sourceType,
        uploadedBy: firebaseUid,
      });
      setModalVisible(false);
    } catch {
      setError('העלאת הקובץ נכשלה, נסו שוב');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <Screen
        back
        title="ייבוא קבצים"
        subtitle="דוחות מהבנק או מחברת האשראי"
        action={
          <Button mode="contained" icon="upload" onPress={() => setModalVisible(true)}>
            העלאת קובץ
          </Button>
        }
      >
        <Panel title={`קבצים שהועלו (${files.length})`}>
          {files.length === 0 ? (
            <Text style={styles.empty}>עדיין לא הועלו קבצים</Text>
          ) : (
            files.map((item, i) => (
              <View key={item.id}>
                {i > 0 && <Divider style={styles.divider} />}
                <Pressable onPress={() => router.push(`/import/${item.id}`)}>
                  {({ pressed }) => (
                    <View style={[styles.row, pressed && styles.pressed]}>
                      <View style={styles.rowMain}>
                        <Text style={styles.name}>{item.fileName}</Text>
                        <View style={styles.metaRow}>
                          <Text style={styles.meta}>
                            {new Date(item.uploadedAt).toLocaleString('he-IL')}
                          </Text>
                          <Tag label={STATUS_LABELS[item.status]} tone={STATUS_TONE[item.status]} />
                        </View>
                      </View>
                      {item.status === 'parsed' && (
                        <Text style={styles.counts}>
                          {item.matchedCount ?? 0} / {item.rowCount ?? 0} שויכו
                        </Text>
                      )}
                    </View>
                  )}
                </Pressable>
              </View>
            ))
          )}
        </Panel>
      </Screen>

      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <Text style={styles.modalTitle}>ייבוא קובץ</Text>
          <Text style={styles.modalHint}>
            הקובץ צריך לכלול עמודות "תאריך" ו"סכום", ורצוי גם "תיאור"/"הודעה" ו"שם"
          </Text>
          <SegmentedButtons
            value={sourceType}
            onValueChange={(v) => setSourceType(v as ImportSourceType)}
            buttons={sourceOptions}
            style={styles.segmented}
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.modalActions}>
            <Button
              mode="contained"
              onPress={onPickAndUpload}
              loading={uploading}
              disabled={uploading}
            >
              בחירת קובץ והעלאה
            </Button>
            <Button mode="text" onPress={() => setModalVisible(false)} disabled={uploading}>
              ביטול
            </Button>
          </View>
        </Modal>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.page },
  divider: { backgroundColor: palette.line },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    gap: spacing.md,
  },
  rowMain: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: palette.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  meta: { fontSize: 12, color: palette.inkFaint },
  counts: { fontSize: 13, color: palette.inkMuted, fontWeight: '600' },
  pressed: { opacity: 0.6 },
  empty: { color: palette.inkFaint, fontSize: 13, paddingVertical: spacing.lg, textAlign: 'center' },
  modal: {
    backgroundColor: palette.surface,
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: 12,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 520,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: palette.ink, marginBottom: spacing.sm },
  modalHint: { fontSize: 12, color: palette.inkFaint, marginBottom: spacing.md, lineHeight: 18 },
  segmented: { marginBottom: spacing.md },
  error: { color: palette.moneyOut, fontSize: 12, marginBottom: spacing.sm },
  modalActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
