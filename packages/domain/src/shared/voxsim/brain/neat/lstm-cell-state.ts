/**
 * Per-agent runtime state for NEAT-LSTM. Not persisted as part of the genome.
 */

export interface LstmCellState {
  /** Per LSTM-node cell value `c[i]`. Length is the LSTM node count. */
  cellState: Float32Array;
  /** Per LSTM-node hidden value `h[i]`. Length is the LSTM node count. */
  hiddenState: Float32Array;
}

export function createLstmCellState(lstmNodeCount: number): LstmCellState {
  return {
    cellState: new Float32Array(lstmNodeCount),
    hiddenState: new Float32Array(lstmNodeCount),
  };
}

export function resetLstmCellState(state: LstmCellState): void {
  state.cellState.fill(0);
  state.hiddenState.fill(0);
}
