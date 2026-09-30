import {Component} from 'react';
import {ScenePreview} from './ScenePreview.jsx';
import {GameCardPreview} from './GameCardPreview.jsx';
import {GameRuntimePreview} from './GameRuntimePreview.jsx';
import './in-game-preview.css';
import './game-runtime-preview.css';

class PreviewBoundary extends Component {
  state = {error: null};
  static getDerivedStateFromError(error) { return {error: error.message || 'Invalid preview data'}; }
  componentDidUpdate(previous) {
    if (this.state.error && previous.revision !== this.props.revision) this.setState({error: null});
  }
  render() {
    if (this.state.error) return <div className="notice error" role="alert">
      <strong>This draft could not be previewed.</strong>
      <p>{this.state.error}</p>
      <p>Your authoring draft is still available. Correct it or undo the last edit, then retry.</p>
      <button onClick={() => this.setState({error: null})}>Retry preview</button>
    </div>;
    return this.props.children;
  }
}

export function InGamePreview({ctx}) {
  return <section className="in-game-preview" aria-label="In game preview">
    <PreviewBoundary key={ctx.ws} revision={ctx.p}>
      {ctx.ws === 'scenes' ? <ScenePreview ctx={ctx}/> :
        ['cards', 'decks', 'tags'].includes(ctx.ws) ? <GameCardPreview ctx={ctx}/> :
          <GameRuntimePreview ctx={ctx}/>}
    </PreviewBoundary>
    <p className="in-game-draft-note">Preview uses your current draft. Saving to a game checkout remains a separate, explicit action.</p>
  </section>;
}
