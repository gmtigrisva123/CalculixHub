/**
 * Everything on the landing page under the first screen, as one piece of code.
 *
 * The first screen is the headline, the sheet and Fig. 1, and it is all a
 * visitor has to download to start. The sections here are fetched alongside it
 * and set under it a moment later (see LandingPage.tsx); they are ordinary
 * document flow, mounted together, so a link to any of them (/#plans) lands
 * where it says.
 */

import { useEffect } from 'react';
import ArchiveShelf from './ArchiveShelf';
import Closing from './Closing';
import Desk from './Desk';
import Fees from './Fees';
import Method from './Method';
import Proposition from './Proposition';
import Questions from './Questions';

interface BelowProps {
  onRegister: () => void;
  onSignIn: () => void;
  /** Called once the sections are in the document. */
  onReady?: () => void;
}

export default function Below({ onRegister, onSignIn, onReady }: BelowProps) {
  useEffect(() => { onReady?.(); }, [onReady]);
  return (
    <>
      <Method />
      <Proposition />
      <ArchiveShelf />
      <Desk onRegister={onRegister} />
      <Fees onRegister={onRegister} />
      <Questions />
      <Closing onRegister={onRegister} onSignIn={onSignIn} />
    </>
  );
}
