import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { SessionListNavigation } from '../navigation/types';
import {
  createSessionGroup,
  deleteProgram,
  getPrograms,
  getSessionGroups,
  renameSessionGroup,
  type ProgramSummary,
  type SessionGroup,
} from '../services/database';
import { getActiveGroupId, getHiddenGroupIds, setActiveGroupId, setGroupHidden } from '../services/preferences';
import { colors, neutrals } from '../theme/colors';

interface SessionSection {
  key: string;
  title: string;
  group: SessionGroup | null;
  data: ProgramSummary[];
}

interface GroupModalState {
  mode: 'create' | 'rename';
  groupId?: number;
  name: string;
}

export default function SessionListScreen() {
  const navigation = useNavigation<SessionListNavigation>();
  const db = useSQLiteContext();
  const [groups, setGroups] = useState<SessionGroup[]>([]);
  const [hiddenIds, setHiddenIds] = useState<number[]>([]);
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupModal, setGroupModal] = useState<GroupModalState | null>(null);
  const loaded = useRef(false);

  const load = useCallback(() => {
    let mounted = true;
    if (!loaded.current) setLoading(true);
    Promise.all([getSessionGroups(db), getPrograms(db), getHiddenGroupIds()])
      .then(([groupRows, programRows, hidden]) => {
        if (!mounted) return;
        setGroups(groupRows);
        setPrograms(programRows);
        setHiddenIds(hidden);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (mounted) setError(cause instanceof Error ? cause.message : 'Erreur inconnue');
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
        loaded.current = true;
      });
    return () => {
      mounted = false;
    };
  }, [db]);

  useFocusEffect(load);

  const sections = useMemo<SessionSection[]>(() => {
    const result: SessionSection[] = groups.map((group) => ({
      key: `group-${group.id}`,
      title: group.nom,
      group,
      data: programs.filter((program) => program.group_id === group.id),
    }));
    const ungrouped = programs.filter((program) => program.group_id === null);
    if (ungrouped.length > 0) {
      result.push({ key: 'ungrouped', title: 'Sans groupe', group: null, data: ungrouped });
    }
    return result;
  }, [groups, programs]);

  const isEmpty = groups.length === 0 && programs.length === 0;

  const confirmDeleteProgram = useCallback(
    (program: ProgramSummary) => {
      Alert.alert(
        'Supprimer la séance',
        `« ${program.nom_seance} » et ses exercices seront supprimés.`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Supprimer',
            style: 'destructive',
            onPress: async () => {
              await deleteProgram(db, program.id);
              load();
            },
          },
        ]
      );
    },
    [db, load]
  );

  const toggleGroupHidden = useCallback(
    async (group: SessionGroup) => {
      const hidden = hiddenIds.includes(group.id);
      await setGroupHidden(group.id, !hidden);
      if (!hidden) {
        // Le groupe est retiré : s'il était le groupe actif de l'accueil, on le désactive.
        const active = await getActiveGroupId();
        if (active === group.id) await setActiveGroupId(null);
      }
      load();
    },
    [hiddenIds, load]
  );

  const openGroupMenu = useCallback(
    (group: SessionGroup) => {
      const hidden = hiddenIds.includes(group.id);
      Alert.alert(group.nom, undefined, [
        {
          text: 'Ajouter une séance',
          onPress: () => navigation.navigate('SessionEditor', { groupId: group.id }),
        },
        {
          text: 'Renommer',
          onPress: () => setGroupModal({ mode: 'rename', groupId: group.id, name: group.nom }),
        },
        {
          text: hidden ? 'Afficher sur la page principale' : 'Retirer de la page principale',
          onPress: () => toggleGroupHidden(group),
        },
        { text: 'Annuler', style: 'cancel' },
      ]);
    },
    [hiddenIds, navigation, toggleGroupHidden]
  );

  const saveGroup = useCallback(async () => {
    const name = groupModal?.name.trim();
    if (!groupModal || !name) {
      setGroupModal(null);
      return;
    }
    if (groupModal.mode === 'create') {
      await createSessionGroup(db, name);
    } else if (groupModal.groupId != null) {
      await renameSessionGroup(db, groupModal.groupId, name);
    }
    setGroupModal(null);
    load();
  }, [db, groupModal, load]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.screenTitle}>Séance</Text>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : isEmpty ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Aucune séance</Text>
          <Text style={styles.emptyText}>
            Crée un groupe (PPL, Maison, Upper/Lower…) puis ajoute-y des séances avec leurs
            exercices, séries, repos et poids.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.group && hiddenIds.includes(section.group.id) ? (
                  <Text style={styles.sectionHidden}>retiré de l’accueil</Text>
                ) : null}
              </View>
              {section.group ? (
                <View style={styles.sectionActions}>
                  <Pressable
                    hitSlop={6}
                    onPress={() =>
                      navigation.navigate('SessionEditor', { groupId: section.group!.id })
                    }
                  >
                    <Text style={styles.sectionAdd}>+ Séance</Text>
                  </Pressable>
                  <Pressable hitSlop={6} onPress={() => openGroupMenu(section.group!)}>
                    <Text style={styles.sectionMenu}>⋯</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          )}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('SessionEditor', { programId: item.id })}
              onLongPress={() => confirmDeleteProgram(item)}
              delayLongPress={400}
            >
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{item.nom_seance}</Text>
                <Text style={styles.rowMeta}>
                  {item.exercise_count} exercice{item.exercise_count > 1 ? 's' : ''}
                </Text>
              </View>
              <Pressable
                style={styles.rowDelete}
                onPress={() => confirmDeleteProgram(item)}
                hitSlop={6}
              >
                <Text style={styles.rowDeleteText}>×</Text>
              </Pressable>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          )}
          renderSectionFooter={({ section }) =>
            section.group && section.data.length === 0 ? (
              <Text style={styles.groupEmptyText}>
                Aucune séance dans ce groupe. Touche « + Séance » ci-dessus.
              </Text>
            ) : null
          }
        />
      )}

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => setGroupModal({ mode: 'create', name: '' })}
          >
            <Text style={styles.secondaryButtonText}>Nouveau groupe</Text>
          </Pressable>
          <Pressable
            style={styles.primaryButton}
            onPress={() => navigation.navigate('SessionEditor', {})}
          >
            <Text style={styles.primaryButtonText}>Nouvelle séance</Text>
          </Pressable>
        </View>
        <Text style={styles.footerHint}>Le × supprime une séance (confirmation demandée)</Text>
      </View>

      <Modal
        visible={groupModal !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setGroupModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {groupModal?.mode === 'rename' ? 'Renommer le groupe' : 'Nouveau groupe'}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex. PPL, Maison, Upper/Lower"
              placeholderTextColor={neutrals.textMuted}
              value={groupModal?.name ?? ''}
              onChangeText={(name) => setGroupModal((prev) => (prev ? { ...prev, name } : prev))}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveGroup}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setGroupModal(null)}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={saveGroup}>
                <Text style={styles.modalConfirmText}>Enregistrer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenTitle: {
    color: neutrals.text,
    fontSize: 28,
    fontWeight: '800',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: neutrals.text,
    fontSize: 20,
    fontWeight: '800',
  },
  emptyText: {
    color: neutrals.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  errorText: {
    color: colors.alert,
    fontSize: 15,
    textAlign: 'center',
  },
  listContent: {
    padding: 20,
    paddingBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  sectionHidden: {
    color: neutrals.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  sectionAdd: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '800',
  },
  sectionMenu: {
    color: neutrals.textMuted,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 22,
  },
  groupEmptyText: {
    color: neutrals.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: neutrals.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: neutrals.border,
    padding: 16,
    marginBottom: 10,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    color: neutrals.text,
    fontSize: 17,
    fontWeight: '700',
  },
  rowMeta: {
    color: colors.secondary,
    fontSize: 13,
    marginTop: 4,
  },
  chevron: {
    color: neutrals.textMuted,
    fontSize: 26,
    marginLeft: 8,
  },
  rowDelete: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: neutrals.surfaceAlt,
    marginRight: 6,
  },
  rowDeleteText: {
    color: colors.alert,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
  separator: {
    height: 0,
  },
  footer: {
    padding: 20,
    paddingBottom: 24,
    gap: 8,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.secondary,
    fontSize: 15,
    fontWeight: '800',
  },
  footerHint: {
    color: neutrals.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: neutrals.surface,
    borderRadius: 18,
    padding: 20,
  },
  modalTitle: {
    color: neutrals.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: neutrals.surfaceAlt,
    borderWidth: 1,
    borderColor: neutrals.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: neutrals.text,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  modalCancel: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalCancelText: {
    color: neutrals.textMuted,
    fontSize: 15,
    fontWeight: '700',
  },
  modalConfirm: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  modalConfirmText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '800',
  },
});
