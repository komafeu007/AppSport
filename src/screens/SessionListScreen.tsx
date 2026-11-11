import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ACTIVE_WORKOUT_BUBBLE_SPACE } from '../components/ActiveWorkoutBubble';
import ActionSheet from '../components/ActionSheet';
import {
  Button,
  ConfirmSheet,
  DashedLine,
  Icon,
  IconButton,
  Input,
  PressableScale,
  Row,
  ScreenHeader,
  Sheet,
  StateView,
  SystemBar,
  type ConfirmRequest,
} from '../components/ui';
import { padIndex } from '../lib/format';
import type { MainTabParamList, SessionListNavigation } from '../navigation/types';
import { useAccount } from '../services/account';
import { useActiveWorkout } from '../services/activeWorkout';
import {
  createSessionGroup,
  deleteProgram,
  deleteSessionGroup,
  getAccount,
  getPrograms,
  getSessionGroups,
  reorderPrograms,
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
import { useThemedStyles, useTheme, type Theme } from '../theme';
import { MAX_FONT_SCALE, spacing, text } from '../theme/tokens';

const groupLetter = (index: number) => String.fromCharCode(65 + (index % 26));

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

/** Poignée de réordonnancement (glisser-déposer) pour une séance. */
function DragHandle({
  onStart,
  onMove,
  onEnd,
}: {
  onStart: () => void;
  onMove: (dy: number) => void;
  onEnd: (dy: number) => void;
}) {
  const onStartRef = useRef(onStart);
  const onMoveRef = useRef(onMove);
  const onEndRef = useRef(onEnd);
  onStartRef.current = onStart;
  onMoveRef.current = onMove;
  onEndRef.current = onEnd;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => onStartRef.current(),
      onPanResponderMove: (_, gesture) => onMoveRef.current(gesture.dy),
      onPanResponderRelease: (_, gesture) => onEndRef.current(gesture.dy),
      onPanResponderTerminate: (_, gesture) => onEndRef.current(gesture.dy),
    })
  ).current;

  const theme = useTheme();

  return (
    <View style={dragHandleStyles.handle} {...pan.panHandlers}>
      <Icon name="grip" size={20} color={theme.colors.textMuted} />
    </View>
  );
}

const dragHandleStyles = StyleSheet.create({
  handle: {
    width: 32,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function SessionListScreen() {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  // Séance mise de côté : on réserve la hauteur de la bulle de reprise.
  const hasActiveWorkout = useActiveWorkout() !== null;
  const navigation = useNavigation<SessionListNavigation>();
  const route = useRoute<RouteProp<MainTabParamList, 'Seance'>>();
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
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const itemLayoutsRef = useRef(new Map<number, { y: number; height: number }>());
  const listRef = useRef<any>(null);

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

  // Depuis l'accueil, « Créer un groupe » arrive ici avec l'ordre d'ouvrir la feuille.
  useEffect(() => {
    if (!route.params?.createGroup) return;
    setGroupModal({ mode: 'create', name: '' });
    navigation.setParams({ createGroup: undefined });
  }, [navigation, route.params?.createGroup]);

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
        message: `Supprimer « ${program.nom_seance} » et ses exercices ?`,
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

  const finishDrag = useCallback(
    (programId: number, dy: number) => {
      const section = sections.find((s) => s.data.some((p) => p.id === programId));
      if (!section) return;
      const list = section.data;
      const originalIndex = list.findIndex((p) => p.id === programId);
      if (originalIndex < 0) return;
      const heights = list.map((p) => itemLayoutsRef.current.get(p.id)?.height ?? 60);
      const draggedHeight = heights[originalIndex];
      const draggedTop = heights.slice(0, originalIndex).reduce((a, b) => a + b, 0);
      const draggedCenter = draggedTop + draggedHeight / 2 + dy;

      let newIndex = list.length - 1;
      let cum = 0;
      for (let i = 0; i < list.length; i++) {
        cum += heights[i];
        if (draggedCenter < cum) {
          newIndex = i;
          break;
        }
      }
      if (newIndex !== originalIndex) {
        const ordered = [...list];
        const [moved] = ordered.splice(originalIndex, 1);
        ordered.splice(newIndex, 0, moved);
        reorderPrograms(db, ordered.map((p) => p.id)).then(() => load());
      }
    },
    [db, load, sections]
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
            ? `Supprimer « ${group.nom} » et ses ${count} séance${count > 1 ? 's' : ''} ?`
            : `Supprimer « ${group.nom} » ?`,
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
      const id = await createSessionGroup(db, accountId, name);
      // Le groupe tout juste créé devient le groupe actif de l'accueil : il est
      // visible tout de suite, même avant d'avoir ajouté sa première séance.
      await setActiveGroupId(accountId, id);
    } else if (groupModal.groupId != null) {
      await renameSessionGroup(db, groupModal.groupId, name);
    }
    setGroupModal(null);
    load();
  }, [accountId, db, groupModal, load]);

  const topContent = (
    <>
      <ScreenHeader
        kicker="02 — Inventaire"
        title="Séances"
        subtitle="Tes groupes et leurs séances."
      />

      <View style={styles.generatorWrap}>
        <PressableScale
          style={styles.generatorBox}
          accessibilityRole="button"
          accessibilityLabel={block?.due ? 'Générer le nouveau programme' : 'Générer un programme'}
          onPress={() =>
            navigation.navigate('ProgramGenerator', block?.due ? { reason: 'bloc' } : undefined)
          }
        >
          <View style={styles.generatorStrip}>
            <View style={styles.generatorStripTitle}>
              <Icon name="alert" size={14} color={theme.colors.onAction} />
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.generatorStripText}>Générateur auto</Text>
            </View>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.generatorStripText}>ARN-GEN</Text>
          </View>
          <View style={styles.generatorRow}>
            <View style={styles.generatorText}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.generatorTitle}>
                {block?.due ? 'Bloc terminé : choisis la suite' : 'Générer un programme'}
              </Text>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.generatorMeta}>
                {block
                  ? `« ${block.group.nom} », semaine ${Math.min(
                      block.elapsedWeeks + 1,
                      block.weeks
                    )} sur ${block.weeks}, ${block.sessionsDone} séance${
                      block.sessionsDone > 1 ? 's' : ''
                    } faite${block.sessionsDone > 1 ? 's' : ''}.${
                      block.due ? ' Nouveau bloc proposé.' : ''
                    }`
                  : 'Un programme adapté à ton profil. Tu le vois avant de l’enregistrer.'}
              </Text>
            </View>
            <Icon name="arrowRight" size={24} color={theme.colors.action} />
          </View>
        </PressableScale>
      </View>
    </>
  );

  const actionsFooter = (
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
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.footerHint}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.footerHintKey}>NOTE ▸ </Text>
        Glisse pour réordonner · appui long pour supprimer.
      </Text>
    </View>
  );

  const groupCountLabel = `${padIndex(groups.length)} GRP`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <SystemBar center="MODULE : SPLITS" right={groupCountLabel} />
      {loading || error || isEmpty ? topContent : null}

      {loading ? (
        <StateView kind="loading" />
      ) : error ? (
        <StateView kind="error" message={error} />
      ) : isEmpty ? (
        <StateView
          kind="empty"
          title="Aucune séance"
          message="Crée un groupe, puis ajoute-y tes séances."
        />
      ) : null}

      {loading || error || isEmpty ? (
        actionsFooter
      ) : (
        <SectionList
          ref={listRef}
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          scrollEnabled={draggingId === null}
          contentContainerStyle={[styles.listContent, hasActiveWorkout && styles.listContentReserved]}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={<View style={styles.listHeaderBleed}>{topContent}</View>}
          ListFooterComponent={<View style={styles.listFooterBleed}>{actionsFooter}</View>}
          renderSectionHeader={({ section }) => {
            const sectionIndex = sections.findIndex((x) => x.key === section.key);
            const letter = section.group ? groupLetter(sectionIndex) : 'X';
            const count = section.data.length;
            const hidden = section.group ? hiddenIds.includes(section.group.id) : false;
            return (
              <View style={styles.sectionHeader}>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.groupCaption}>
                  {`GRP-${letter} · ${padIndex(count)} SÉANCE${count > 1 ? 'S' : ''}${
                    hidden ? ' · RETIRÉ DE L’ACCUEIL' : ''
                  }`}
                </Text>
                <View style={styles.groupHeadRow}>
                  <PressableScale
                    style={styles.groupNameWrap}
                    disabled={!section.group}
                    accessibilityRole={section.group ? 'button' : undefined}
                    accessibilityLabel={`Statistiques du groupe ${section.title}`}
                    onPress={() =>
                      section.group
                        ? navigation.navigate('GroupStats', { groupId: section.group.id })
                        : undefined
                    }
                  >
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.groupName} numberOfLines={2}>
                      {section.title}
                    </Text>
                  </PressableScale>
                  {section.group ? (
                    <View style={styles.sectionActions}>
                      <Button
                        label="+ Séance"
                        variant="secondary"
                        size="sm"
                        onPress={() =>
                          navigation.navigate('SessionEditor', { groupId: section.group!.id })
                        }
                      />
                      <IconButton
                        icon="more"
                        accessibilityLabel={`Options du groupe ${section.title}`}
                        onPress={() => setMenuGroup(section.group)}
                      />
                    </View>
                  ) : null}
                </View>
                <DashedLine style={styles.groupUnderline} />
              </View>
            );
          }}
          renderItem={({ item, index, section }) => {
            const isDragging = draggingId === item.id;
            return (
              <View
                onLayout={(e) => {
                  itemLayoutsRef.current.set(item.id, {
                    y: e.nativeEvent.layout.y,
                    height: e.nativeEvent.layout.height,
                  });
                }}
                style={
                  isDragging
                    ? { transform: [{ translateY: dragOffset }], zIndex: 20, elevation: 20 }
                    : undefined
                }
              >
                <Row
                  inset={false}
                  last={index === (section as SessionSection).data.length - 1}
                  accessibilityLabel={item.nom_seance}
                  onPress={() => navigation.navigate('SessionEditor', { programId: item.id })}
                  onLongPress={() => confirmDeleteProgram(item)}
                >
                  <DragHandle
                    onStart={() => {
                      setDraggingId(item.id);
                      setDragOffset(0);
                    }}
                    onMove={setDragOffset}
                    onEnd={(dy) => {
                      finishDrag(item.id, dy);
                      setDraggingId(null);
                      setDragOffset(0);
                    }}
                  />
                  <View style={styles.codeBox}>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.codeText}>
                      {`${groupLetter(sections.findIndex((x) => x.key === (section as SessionSection).key))}-${padIndex(index + 1)}`}
                    </Text>
                  </View>
                  <View style={styles.rowBody}>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.rowTitle}>{item.nom_seance}</Text>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.rowMeta}>
                      {`${padIndex(item.exercise_count)} EXO${item.exercise_count > 1 ? 'S' : ''}`}
                    </Text>
                  </View>
                  <IconButton
                    icon="close"
                    tone="danger"
                    accessibilityLabel={`Supprimer ${item.nom_seance}`}
                    onPress={() => confirmDeleteProgram(item)}
                  />
                </Row>
              </View>
            );
          }}
          renderSectionFooter={({ section }) =>
            section.group && section.data.length === 0 ? (
              <PressableScale
                style={styles.emptySlot}
                accessibilityRole="button"
                accessibilityLabel={`Ajouter une séance à ${section.title}`}
                onPress={() => navigation.navigate('SessionEditor', { groupId: section.group!.id })}
              >
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.emptySlotText}>[ Emplacement vide ]</Text>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.emptySlotAction}>+ Ajouter une séance</Text>
              </PressableScale>
            ) : null
          }
        />
      )}

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
            placeholder="Ex. PPL, Maison"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={saveGroup}
            accessibilityLabel="Nom du groupe"
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
    paddingBottom: spacing.sm,
  },
  /** Place libre pour la bulle de reprise, qui flotte en bas de l'écran. */
  listContentReserved: {
    paddingBottom: spacing.sm + ACTIVE_WORKOUT_BUBBLE_SPACE,
  },
  /** L'en-tête et les actions défilent avec la liste, qui a déjà sa marge de 20. */
  listHeaderBleed: {
    marginHorizontal: -spacing.xl,
  },
  listFooterBleed: {
    marginHorizontal: -spacing.xl,
    marginTop: spacing.lg,
  },
  generatorWrap: {
    paddingHorizontal: spacing.xl,
  },
  generatorBox: {
    borderWidth: 1,
    borderColor: theme.colors.action,
  },
  generatorStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.action,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  generatorStripTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  generatorStripText: {
    ...text.caption,
    color: theme.colors.onAction,
  },
  generatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  generatorText: {
    flex: 1,
  },
  generatorTitle: {
    ...text.sectionTitle,
    color: theme.colors.text,
  },
  generatorMeta: {
    ...text.meta,
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
    marginBottom: spacing.xs,
  },
  groupCaption: {
    ...text.caption,
    color: theme.colors.textMuted,
  },
  groupHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  groupNameWrap: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  groupName: {
    ...text.title,
    color: theme.colors.text,
  },
  groupUnderline: {
    marginTop: spacing.sm,
  },
  emptySlot: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderStrong,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  emptySlotText: {
    ...text.caption,
    color: theme.colors.textMuted,
  },
  emptySlotAction: {
    ...text.label,
    color: theme.colors.action,
  },
  codeBox: {
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  codeText: {
    ...text.caption,
    color: theme.colors.text,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    ...text.cardTitle,
    color: theme.colors.text,
  },
  rowMeta: {
    ...text.caption,
    color: theme.colors.textMuted,
    marginTop: spacing.xs,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  footerButton: {
    flex: 1,
  },
  footerHint: {
    ...text.caption,
    color: theme.colors.textMuted,
  },
  footerHintKey: {
    color: theme.colors.action,
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
