import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type MainTabParamList = {
  Main: undefined;
  Seance: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<MainTabParamList> | undefined;
  SessionEditor: { programId?: number; groupId?: number } | undefined;
  LiveWorkout: { programId: number };
  /** Récapitulatif post-séance (Module 4 - Stats), ouvert à la fin d'une séance. */
  SessionSummary: { sessionId: number };
  /**
   * Écrans affichés **sans** compte actif (onboarding). Noms volontairement
   * distincts des écrans app : React Navigation ne réinitialise la navigation
   * que si les noms changent (pattern « auth flow »).
   */
  Welcome: undefined;
  WelcomeForm: { accountId?: number } | undefined;
  /** Choix / gestion des comptes (profils). */
  Accounts: undefined;
  /** Création d'un profil (sans id) ou édition de l'actif (avec id). */
  AccountForm: { accountId?: number } | undefined;
  /**
   * Aperçu d'un programme généré (Module 2) : rien n'est écrit en base avant
   * validation. `reason: 'bloc'` = fin de bloc de 8 semaines (changement proposé).
   */
  ProgramGenerator: { accountId?: number; reason?: 'bloc' } | undefined;
  /** Même écran pendant l'onboarding (sans compte actif), cf. pattern « auth flow ». */
  WelcomeGenerator: { accountId: number };
};

/** Navigation depuis l'onglet Main : change d'onglet ou empile un écran. */
export type MainScreenNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Main'>,
  NativeStackNavigationProp<RootStackParamList>
>;

/** Navigation depuis l'onglet Séance : change d'onglet ou empile un écran. */
export type SessionListNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Seance'>,
  NativeStackNavigationProp<RootStackParamList>
>;
