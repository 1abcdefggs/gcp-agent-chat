const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Test targets
const { GeminiClient } = require('../src/bridge/gemini_client');
const { MessageTree } = require('../src/tree/message_tree');
const { ThreadController } = require('../src/tree/thread_controller');
const { PersonaManager, PERSONA_TEMPLATES } = require('../src/team/persona_registry');
const { ChiefOrchestrator } = require('../src/team/chief_orchestrator');
const { PatternDetector } = require('../src/learning/pattern_detector');
const { RuleGenerator } = require('../src/learning/rule_generator');
const { ChatStateManager } = require('../src/state/chat_state_manager');

async function runComprehensiveTestSuite() {
    console.log('Starting GCP Agent Chat Comprehensive Phase 3 & Native SDK Test Suite...\n');

    // -- Test 1: Native GeminiClient & Tools --
    console.log('> Test 1: Native GeminiClient & Workspace Tools (Zero Python Dependency)');
    const client = new GeminiClient();
    assert.ok(client instanceof GeminiClient);

    const status = await client.checkStatus({ projectId: 'test-project-id', location: 'global' });
    assert.strictEqual(status.authenticated, true);
    assert.strictEqual(status.project_id, 'test-project-id');

    // Test tool executions
    const filesList = client.toolListFiles('.');
    assert.ok(filesList.includes('package.json'));

    const packageContent = client.toolReadFile('package.json');
    assert.ok(packageContent.includes('gcp-agent-chat'));

    // Test tool security guardrails
    const blockedFile = client.toolReadFile('.env');
    assert.ok(blockedFile.includes('[Security Guardrail Error]'));

    const blockedCmd = client.toolRunCommand('rm -rf /');
    assert.ok(blockedCmd.includes('[Security Guardrail Error]'));
    console.log('[PASS] Test 1: Native GeminiClient, tools, and security guardrails verified.');

    // -- Test 2: MessageTree & TreeNode Operations --
    console.log('\n> Test 2: MessageTree & TreeNode Operations');
    const tree = new MessageTree();
    const root1 = tree.addMessage({ sender: 'user', text: 'Hello, build a backend' });
    assert.strictEqual(tree.rootNodes.length, 1);
    assert.strictEqual(root1.parentId, null);

    const child1 = tree.addMessage({ sender: 'chief', text: 'Analyzing requirements' }, root1.id);
    assert.strictEqual(root1.children.length, 1);
    assert.strictEqual(child1.parentId, root1.id);

    const grandChild = tree.addMessage({ sender: 'architect', text: 'Architecture blueprint' }, child1.id);
    assert.strictEqual(child1.children.length, 1);
    assert.strictEqual(grandChild.parentId, child1.id);

    const isCollapsed = tree.toggleCollapse(child1.id);
    assert.strictEqual(isCollapsed, true);
    assert.strictEqual(child1.isCollapsed, true);

    // Serialization test
    const serialized = tree.toJSON();
    assert.strictEqual(serialized.length, 1);
    assert.strictEqual(serialized[0].children.length, 1);
    assert.strictEqual(serialized[0].children[0].children.length, 1);

    // Deserialization test
    const restoredTree = MessageTree.fromJSON(serialized);
    assert.strictEqual(restoredTree.rootNodes.length, 1);
    assert.strictEqual(restoredTree.getNode(child1.id).children.length, 1);
    assert.strictEqual(restoredTree.getNode(child1.id).isCollapsed, true);
    console.log('[PASS] Test 2: MessageTree nesting, collapse, and JSON serialization verified.');

    // -- Test 3: ThreadController --
    console.log('\n> Test 3: ThreadController Operations');
    const controller = new ThreadController(tree);
    controller.setActiveThread(root1.id);
    const activeInfo = controller.getActiveThreadInfo();
    assert.strictEqual(activeInfo.parentId, root1.id);
    assert.strictEqual(activeInfo.childCount, 1);

    const allThreads = controller.getAllThreads();
    assert.strictEqual(allThreads.length, 1);
    assert.strictEqual(allThreads[0].id, root1.id);

    controller.closeActiveThread();
    assert.strictEqual(controller.getActiveThreadInfo(), null);
    console.log('[PASS] Test 3: ThreadController focus, thread list, and navigation verified.');

    // -- Test 4: PersonaManager --
    console.log('\n> Test 4: Persona Registry & Manager');
    const persona = new PersonaManager('office');
    assert.strictEqual(persona.getActiveTemplate().id, 'office');

    assert.strictEqual(persona.setTemplate('guild'), true);
    assert.strictEqual(persona.getActiveTemplate().id, 'guild');

    assert.strictEqual(persona.setTemplate('cockpit'), true);
    assert.strictEqual(persona.getActiveTemplate().id, 'cockpit');

    const available = PersonaManager.getAvailableTemplates();
    assert.strictEqual(available.length, 3);
    console.log('[PASS] Test 4: Persona templates and role switching verified.');

    // -- Test 5: ChiefOrchestrator --
    console.log('\n> Test 5: ChiefOrchestrator Intent Trigger');
    const orchestrator = new ChiefOrchestrator({
        personaManager: persona,
        sendRpcPrompt: async () => 'Mocked sub-agent design output'
    });
    assert.strictEqual(orchestrator.shouldOrchestrate('team design and implement'), true);
    assert.strictEqual(orchestrator.shouldOrchestrate('hello'), false);
    console.log('[PASS] Test 5: Multi-agent orchestration intent detection verified.');

    // -- Test 6: PatternDetector (Proactive Learning) --
    console.log('\n> Test 6: PatternDetector Repetition Detection');
    const detector = new PatternDetector({ threshold: 2 });
    let res1 = detector.recordPrompt('Fix the corrupted encoding in the API response');
    assert.strictEqual(res1.shouldSuggest, false);

    let res2 = detector.recordPrompt('Terminal output also has corrupted encoding issues (mojibake)');
    assert.strictEqual(res2.shouldSuggest, true);
    assert.strictEqual(res2.pattern.topic, 'EncodingStandard');
    assert.strictEqual(res2.pattern.ruleFileName, 'encoding_standard.md');
    console.log(`[PASS] Test 6: Detected repeated pattern for topic "${res2.pattern.topic}".`);

    // -- Test 7: RuleGenerator --
    console.log('\n> Test 7: RuleGenerator Workspace Output');
    const tempWs = path.join(__dirname, '..', '.storage', 'test_ws');
    const genResult = RuleGenerator.generateRuleFile(tempWs, {
        ruleFileName: 'test_rule.md',
        title: 'Test Rule Title',
        description: 'Test rule description for automated testing'
    });
    assert.strictEqual(genResult.success, true);
    assert.strictEqual(fs.existsSync(genResult.filePath), true);
    const content = fs.readFileSync(genResult.filePath, 'utf-8');
    assert.strictEqual(content.includes('Test Rule Title'), true);

    // Cleanup test ws
    fs.rmSync(tempWs, { recursive: true, force: true });
    console.log('[PASS] Test 7: Rule generation and filesystem writing verified.');

    // -- Test 8: Model & Language Selection in ChatStateManager --
    console.log('\n> Test 8: Model & Language Selection in ChatStateManager');
    const state = new ChatStateManager();
    assert.strictEqual(state.selectedModel, 'gemini-3.7-flash');

    state.setModel('gemini-2.5-pro');
    assert.strictEqual(state.selectedModel, 'gemini-2.5-pro');

    state.setLanguage('ja');
    assert.strictEqual(state.targetLanguage, 'ja');
    console.log('[PASS] Test 8: Model and language state selection verified.');

    console.log('\nALL 8 TESTS PASSED SUCCESSFULLY! Phase 3 & Native SDK architecture verified.');
}

runComprehensiveTestSuite().catch(err => {
    console.error('\n[FAIL] Test Suite Failed:', err);
    process.exit(1);
});
