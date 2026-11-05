import Check from 'lucide-react-native/icons/check';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Dot from 'lucide-react-native/icons/dot';
import Dumbbell from 'lucide-react-native/icons/dumbbell';
import Ellipsis from 'lucide-react-native/icons/ellipsis';
import GripVertical from 'lucide-react-native/icons/grip-vertical';
import House from 'lucide-react-native/icons/house';
import Minus from 'lucide-react-native/icons/minus';
import Play from 'lucide-react-native/icons/play';
import Plus from 'lucide-react-native/icons/plus';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import Square from 'lucide-react-native/icons/square';
import TriangleAlert from 'lucide-react-native/icons/triangle-exclamation-point';
import X from 'lucide-react-native/icons/x';

import { useTheme } from '../../theme';

/**
 * Jeu d'icônes unique de l'app (DA §9.3) : un seul set tracé, grille de 24 px,
 * trait de 2 px. Les écrans ne dessinent plus de glyphe texte (×, ⋯, ✓…) : ils
 * demandent un nom sémantique ici, ce qui garde une seule famille visuelle.
 *
 * Les icônes sont importées **une par une** (`lucide-react-native/icons/…`) :
 * importer la racine embarquerait les 1 600 dessins dans le bundle.
 */
const ICONS = {
  alert: TriangleAlert,
  check: Check,
  chevronRight: ChevronRight,
  close: X,
  dot: Dot,
  dumbbell: Dumbbell,
  grip: GripVertical,
  home: House,
  minus: Minus,
  more: Ellipsis,
  play: Play,
  plus: Plus,
  refresh: RefreshCw,
  sessions: Dumbbell,
  stop: Square,
} as const;

export type IconName = keyof typeof ICONS;

interface Props {
  name: IconName;
  /** Taille du dessin (24 par défaut, grille de la DA). */
  size?: number;
  /** Couleur du trait ; par défaut l'encre du thème. */
  color?: string;
  /** Épaisseur du trait (2 px par défaut). */
  strokeWidth?: number;
}

export default function Icon({ name, size = 24, color, strokeWidth = 2 }: Props) {
  const theme = useTheme();
  const Glyph = ICONS[name];
  return <Glyph size={size} color={color ?? theme.colors.text} strokeWidth={strokeWidth} />;
}
