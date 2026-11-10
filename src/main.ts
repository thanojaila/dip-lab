import './styles.css';
import { App } from './app/App';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app');
void new App(root).start();
