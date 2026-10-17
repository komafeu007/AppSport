import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useRef, useState } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ActionSheet from '../components/ActionSheet';
import {
  Appear,
  Button,
  Card,
  ConfirmSheet,
  IconButton,
  Input,
  ScreenHeader,
  SectionTitle,
  Sheet,
  StateView,
  type ConfirmRequest,
} from '../components/ui';
import type { SessionListNavigation } from '../navigation/types';
import {
  createSessionGroup,
  deleteProgram,
  deleteSessionGroup,
  getPrograms,
  getSessionGroups,
  renameSessionGroup,
  type ProgramSummary,
  type SessionGroup,
} from '../services/database';
import {
  getActiveGroupId,
  getHiddenGroupIds,
  setActiveGroupId,
  setGroupHidden,
} from '../services/preferences';
import { colors, neutrals } from '../theme/colors';
import { spacing, text } from '../theme/tokens';

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
  const [menuGroup, setMenuGroup] = useState<SessionGroup | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
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
      setConfirm({
        title: 'Supprimer la séance',
        message: `« ${program.nom_seance} » et ses exercices seront supprimés.`,
        confirmLabel: 'Supprimer',
        destructive: true,
        onConfirm: async () => {
          await deleteProgram(db, program.id);
          load();
        },
      });
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

  const confirmDeleteGroup = useCallback(
    (group: SessionGroup) => {
      const count = programs.filter((program) => program.group_id === group.id).length;
      setConfirm({
        title: 'Supprimer le groupe',
        message:
          count > 0
            ? `« ${group.nom} » et ses ${count} séance${count > 1 ? 's' : ''} seront supprimés.`
            : `« ${group.nom} » sera supprimé.`,
        confirmLabel: 'Supprimer',
        destructive: true,
        onConfirm: async () => {
          await deleteSessionGroup(db, group.id);
          // Les préférences d'accueil ne doivent plus pointer vers ce groupe.
          await setGroupHidden(group.id, false);
          const active = await getActiveGroupId();
          if (active === group.id) await setActiveGroupId(null);
          load();
        },
      });
    },
    [db, load, programs]
  );

  const menuItems = useMemo(
    () =>
      menuGroup
        ? [
            {
              label: 'Ajouter une séance',
              onPress: () => navigation.navigate('SessionEditor', { groupId: menuGroup.id }),
            },
            {
              label: 'Renommer',
              onPress: () =>
                setGroupModal({ mode: 'rename', groupId: menuGroup.id, name: menuGroup.nom }),
            },
            {
              label: hiddenIds.includes(menuGroup.id)
                ? 'Afficher sur la page principale'
                : 'Retirer de la page principale',
              onPress: () => toggleGroupHidden(menuGroup),
            },
            {
              label: 'Supprimer le groupe',
              destructive: true,
              onPress: () => confirmDeleteGroup(menuGroup),
            },
          ]
        : [],
    [confirmDeleteGroup, hiddenIds, menuGroup, navigation, toggleGroupHidden]
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
      <ScreenHeader
        title="Séance"
        subtitle="Tes groupes (splits) et les séances qu'ils contiennent."
      />

      {loading ? (
        <StateView kind="loading" />
      ) : error ? (
        <StateView kind="error" message={error} />
      ) : isEmpty ? (
        <StateView
          kind="empty"
          title="Aucune séance"
          message="Crée un groupe (PPL, Maison, Upper/Lower…) puis ajoute-y des séances avec leurs exercices, séries, repos et poids."
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Appear>
              <SectionTitle
                style={styles.sectionHeader}
                hint={
                  section.group && hiddenIds.includes(section.group.id)
                    ? 'retiré de l’accueil'
                    : undefined
                }
                right={
                  section.group ? (
                    <View style={styles.sectionActions}>
                      <Button
                        label="+ Séance"
                        variant="ghost"
                        size="sm"
                        onPress={() =>
                          navigation.navigate('SessionEditor', { groupId: section.group!.id })
                        }
                      />
                      <IconButton
                        glyph="⋯"
                        accessibilityLabel={`Options du groupe ${section.title}`}
                        onPress={() => setMenuGroup(section.group)}
                      />
                    </View>
                  ) : undefined
                }
              >
                {section.title}
              </SectionTitle>
            </Appear>
          )}
          renderItem={({ item, index }) => (
            <Appear delay={Math.min(index * 50, 200)} offset={8}>
              <Card
                style={styles.row}
                accessibilityLabel={item.nom_seance}
                onPress={() => navigation.navigate('SessionEditor', { programId: item.id })}
                onLongPress={() => confirmDeleteProgram(item)}
              >
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{item.nom_seance}</Text>
                  <Text style={styles.rowMeta}>
                    {item.exercise_count} exercice{item.exercise_count > 1 ? 's' : ''}
                  </Text>
                </View>
                <IconButton
                  glyph="×"
                  tone="danger"
                  accessibilityLabel={`Supprimer ${item.nom_seance}`}
                  onPress={() => confirmDeleteProgram(item)}
                />
                <Text style={styles.chevron}>›</Text>
              </Card>
            </Appear>
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
          <Button
            label="Nouveau groupe"
            variant="secondary"
            size="lg"
            style={styles.footerButton}
            onPress={() => setGroupModal({ mode: 'create', name: '' })}
          />
          <Button
            label="Nouvelle séance"
            size="lg"
            style={styles.footerButton}
            onPress={() => navigation.navigate('SessionEditor', {})}
          />
        </View>
        <Text style={styles.footerHint}>
          Appui long ou × supprime une séance · ⋯ renomme ou supprime un groupe
        </Text>
      </View>

      <ActionSheet
        visible={menuGroup !== null}
        title={menuGroup?.nom}
        items={menuItems}
        onClose={() => setMenuGroup(null)}
      />

      <Sheet
        visible={groupModal !== null}
        title={groupModal?.mode === 'rename' ? 'Renommer le groupe' : 'Nouveau groupe'}
        onClose={() => setGroupModal(null)}
      >
        <View style={styles.modalContent}>
          <Input
            value={groupModal?.name ?? ''}
            onChangeText={(name) => setGroupModal((prev) => (prev ? { ...prev, name } : prev))}
            placeholder="Ex. PPL, Maison, Upper/Lower"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={saveGroup}
          />
          <View style={styles.modalActions}>
            <Button
              label="Annuler"
              variant="ghost"
              style={styles.footerButton}
              onPress={() => setGroupModal(null)}
            />
            <Button
              label="Enregistrer"
              style={styles.footerButton}
              onPress={saveGroup}
            />
          </View>
        </View>
      </Sheet>

      <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionHeader: {
    marginTop: spacing.xl,
  },
  groupEmptyText: {
    ...text.meta,
    color: neutrals.textMuted,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm + 2,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    ...text.subtitle,
    color: neutrals.text,
  },
  rowMeta: {
    ...text.caption,
    color: colors.secondary,
    marginTop: spacing.xs,
  },
  chevron: {
    color: neutrals.textMuted,
    fontSize: 26,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
  },
  footerButton: {
    flex: 1,
  },
  footerHint: {
    ...text.caption,
    color: neutrals.textMuted,
    textAlign: 'center',
  },
  modalContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
});
