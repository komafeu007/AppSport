import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useRef, useState } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ACTIVE_WORKOUT_BUBBLE_SPACE } from '../components/ActiveWorkoutBubble';
import ActionSheet from '../components/ActionSheet';
import {
  Appear,
  Button,
  Card,
  ConfirmSheet,
  IconButton,
  Input,
  Row,
  ScreenHeader,
  SectionTitle,
  Sheet,
  StateView,
  type ConfirmRequest,
} from '../components/ui';
import type { SessionListNavigation } from '../navigation/types';
import { useAccount } from '../services/account';
import { useActiveWorkout } from '../services/activeWorkout';
import {
  createSessionGroup,
  deleteProgram,
  deleteSessionGroup,
  getAccount,
  getPrograms,
  getSessionGroups,
  renameSessionGroup,
  type ProgramSummary,
  type SessionGroup,
} from '../services/database';
import { getBlockStatus, type BlockStatus } from '../services/programGeneration';
import {
  getActiveGroupId,
  getHiddenGroupIds,
  setActiveGroupId,
  setGroupHidden,
} from '../services/preferences';
import { useThemedStyles, type Theme } from '../theme';
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
  const styles = useThemedStyles(createStyles);
  // Séance mise de côté : on réserve la hauteur de la bulle de reprise.
  const hasActiveWorkout = useActiveWorkout() !== null;
  const navigation = useNavigation<SessionListNavigation>();
  const db = useSQLiteContext();
  const { accountId } = useAccount();
  const [groups, setGroups] = useState<SessionGroup[]>([]);
  const [hiddenIds, setHiddenIds] = useState<number[]>([]);
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupModal, setGroupModal] = useState<GroupModalState | null>(null);
  const [menuGroup, setMenuGroup] = useState<SessionGroup | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [block, setBlock] = useState<BlockStatus | null>(null);
  const loaded = useRef(false);

  const load = useCallback(() => {
    if (accountId === null) return;
    let mounted = true;
    if (!loaded.current) setLoading(true);
    Promise.all([
      getSessionGroups(db, accountId),
      getPrograms(db, accountId),
      getHiddenGroupIds(accountId),
      getAccount(db, accountId).then((row) => (row ? getBlockStatus(db, row) : null)),
    ])
      .then(([groupRows, programRows, hidden, blockStatus]) => {
        if (!mounted) return;
        setGroups(groupRows);
        setPrograms(programRows);
        setHiddenIds(hidden);
        setBlock(blockStatus);
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
  }, [accountId, db]);

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
      if (accountId === null) return;
      const hidden = hiddenIds.includes(group.id);
      await setGroupHidden(accountId, group.id, !hidden);
      if (!hidden) {
        // Le groupe est retiré : s'il était le groupe actif de l'accueil, on le désactive.
        const active = await getActiveGroupId(accountId);
        if (active === group.id) await setActiveGroupId(accountId, null);
      }
      load();
    },
    [accountId, hiddenIds, load]
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
          if (accountId === null) return;
          await setGroupHidden(accountId, group.id, false);
          const active = await getActiveGroupId(accountId);
          if (active === group.id) await setActiveGroupId(accountId, null);
          load();
        },
      });
    },
    [accountId, db, load, programs]
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
    if (!groupModal || !name || accountId === null) {
      setGroupModal(null);
      return;
    }
    if (groupModal.mode === 'create') {
      await createSessionGroup(db, accountId, name);
    } else if (groupModal.groupId != null) {
      await renameSessionGroup(db, groupModal.groupId, name);
    }
    setGroupModal(null);
    load();
  }, [accountId, db, groupModal, load]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Séance"
        subtitle="Tes groupes (splits) et les séances qu'ils contiennent."
      />

      <Appear style={styles.generatorWrap}>
        <Card
          tone={block?.due ? 'accent' : 'default'}
          accessibilityLabel={
            block?.due ? 'Générer le nouveau programme' : 'Générer un programme'
          }
          onPress={() =>
            navigation.navigate(
              'ProgramGenerator',
              block?.due ? { reason: 'bloc' } : undefined
            )
          }
        >
          <View style={styles.generatorRow}>
            <View style={styles.generatorText}>
              <Text style={styles.generatorTitle}>
                {block?.due ? 'Bloc terminé — choisis le nouveau programme' : 'Générer un programme'}
              </Text>
              <Text style={styles.generatorMeta}>
                {block
                  ? `« ${block.group.nom} » · semaine ${Math.min(
                      block.elapsedWeeks + 1,
                      block.weeks
                    )}/${block.weeks} · ${block.sessionsDone} séance${
                      block.sessionsDone > 1 ? 's' : ''
                    } faite${block.sessionsDone > 1 ? 's' : ''}${
                      block.due ? ' → un nouveau bloc est proposé' : ''
                    }`
                  : 'Séances calculées à partir de ton profil (objectif, niveau, matériel, durée), avec aperçu et régénération avant enregistrement.'}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </View>
        </Card>
      </Appear>

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
          contentContainerStyle={[styles.listContent, hasActiveWorkout && styles.listContentReserved]}
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
                        variant="tertiary"
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
          renderItem={({ item, index, section }) => (
            <Row
              inset={false}
              last={index === section.data.length - 1}
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
            </Row>
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
              variant="tertiary"
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

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  /** Place libre pour la bulle de reprise, qui flotte en bas de l'écran. */
  listContentReserved: {
    paddingBottom: spacing.sm + ACTIVE_WORKOUT_BUBBLE_SPACE,
  },
  generatorWrap: {
    paddingHorizontal: spacing.xl,
  },
  generatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  generatorText: {
    flex: 1,
  },
  generatorTitle: {
    ...text.subtitle,
    color: theme.colors.text,
  },
  generatorMeta: {
    ...text.caption,
    color: theme.colors.textMuted,
    marginTop: spacing.xs,
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
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    ...text.subtitle,
    color: theme.colors.text,
  },
  rowMeta: {
    ...text.caption,
    color: theme.colors.textMuted,
    marginTop: spacing.xs,
  },
  chevron: {
    ...text.title,
    color: theme.colors.textMuted,
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
    color: theme.colors.textMuted,
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
