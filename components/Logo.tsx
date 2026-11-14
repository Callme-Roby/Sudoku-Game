import { LOGO } from '@/lib/pixel/logo';
import { Pixel } from './Pixel';

export function Logo() {
  return (
    <h1 className="logo-wrap" style={{ margin: 0 }}>
      <Pixel rows={LOGO} label="Sudoku" className="logo" />
    </h1>
  );
}
