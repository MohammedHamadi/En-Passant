import {
  executeCommand
} from '../tournament/commands.mjs';
import {
  TournamentError
} from '../tournament/model.mjs';
export async function mutate(repository, action, input, actor, options) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const snapshot = await repository.read();
    const result = executeCommand(snapshot, action, input, actor, options);
    try {
      await repository.commit(snapshot.revision, result.state, actor.email, action);
      return result.data;
    } catch (error) {
      if (error.code !== 'STALE_REVISION' || attempt === 5) throw error;
    }
  }
}
export class MemoryRepository {
  constructor(snapshot) {
    this.state = structuredClone(snapshot);
    this.audit = [];
  }
  async read() {
    return structuredClone(this.state);
  }
  async commit(expected, state, actor, action) {
    if (this.state.revision !== expected) throw new TournamentError('State changed. Retry.', 409,
      'STALE_REVISION');
    this.audit.push({
      actor,
      action,
      old_value: this.state,
      new_value: structuredClone(state)
    });
    this.state = structuredClone(state);
  }
}
