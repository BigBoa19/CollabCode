// Test file for findDifference function insertion logic
// Run with: node test-diff.js

// Import the findDifference function from script.js
// Note: In a real test environment, you'd use a proper testing framework
// For now, we'll copy the function here for testing

function findDifference(oldText, newText) {
  // Simple diff algorithm
  if (newText.length > oldText.length) { // Insertion
    let start = 0; let end = newText.length;
    let startFound = false;
    for (let i = 0; i < newText.length; i++) {
      if (newText[i] !== oldText[i] && !startFound) {
        start = i;
        startFound = true;
      }  
      if (newText.slice(i) === oldText.slice(start)) end = i;
    }
    return {
      type: 'insert',
      content: newText.slice(start, Math.min(end, newText.length)),
      position: start
    }
  } else if (newText.length < oldText.length) { // Deletion
    let start = 0; let end = oldText.length;
    let startFound = false;
    for (let i = 0; i < oldText.length; i++) {
      if (newText[i] !== oldText[i] && !startFound) {
        start = i;
        startFound = true;
      }  
      if (oldText.slice(i) === newText.slice(start)) end = i;
    }
    return {
      type: 'delete',
      content: oldText.slice(start, Math.min(end, oldText.length)),
      position: start
    }
  }
  return null;
}

// Test framework
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, testFunction) {
    this.tests.push({ name, testFunction });
  }

  run() {
    console.log('🧪 Running findDifference Insertion Tests\n');
    console.log('=' .repeat(50));

    this.tests.forEach(({ name, testFunction }) => {
      try {
        testFunction();
        console.log(`✅ ${name}`);
        this.passed++;
      } catch (error) {
        console.log(`❌ ${name}`);
        console.log(`   Error: ${error.message}`);
        this.failed++;
      }
    });

    console.log('\n' + '=' .repeat(50));
    console.log(`📊 Results: ${this.passed} passed, ${this.failed} failed`);
  }
}

const runner = new TestRunner();

// Test cases for insertion logic
runner.test('Empty to single character', () => {
  const result = findDifference('', 'a');
  if (!result || result.type !== 'insert' || result.content !== 'a' || result.position !== 0) {
    throw new Error(`Expected {type: 'insert', content: 'a', position: 0}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Empty to multiple characters', () => {
  const result = findDifference('', 'hello');
  if (!result || result.type !== 'insert' || result.content !== 'hello' || result.position !== 0) {
    throw new Error(`Expected {type: 'insert', content: 'hello', position: 0}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Append single character', () => {
  const result = findDifference('hello', 'helloa');
  if (!result || result.type !== 'insert' || result.content !== 'a' || result.position !== 5) {
    throw new Error(`Expected {type: 'insert', content: 'a', position: 5}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Append multiple characters', () => {
  const result = findDifference('hello', 'hello world');
  if (!result || result.type !== 'insert' || result.content !== ' world' || result.position !== 5) {
    throw new Error(`Expected {type: 'insert', content: ' world', position: 5}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Insert at beginning', () => {
  const result = findDifference('hello', 'ahello');
  if (!result || result.type !== 'insert' || result.content !== 'a' || result.position !== 0) {
    throw new Error(`Expected {type: 'insert', content: 'a', position: 0}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Insert in middle', () => {
  const result = findDifference('hello', 'helxlo');
  console.log(result)
  if (!result || result.type !== 'insert' || result.content !== 'x' || result.position !== 3) {
    throw new Error(`Expected {type: 'insert', content: 'x', position: 3}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Insert multiple characters in middle', () => {
  const result = findDifference('hello', 'helxyzlo');
  if (!result || result.type !== 'insert' || result.content !== 'xyz' || result.position !== 3) {
    throw new Error(`Expected {type: 'insert', content: 'xyz', position: 3}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Insert at end with existing text', () => {
  const result = findDifference('hello', 'hello!');
  if (!result || result.type !== 'insert' || result.content !== '!' || result.position !== 5) {
    throw new Error(`Expected {type: 'insert', content: '!', position: 5}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Insert special characters', () => {
  const result = findDifference('hello', 'hello!@#');
  if (!result || result.type !== 'insert' || result.content !== '!@#' || result.position !== 5) {
    throw new Error(`Expected {type: 'insert', content: '!@#', position: 5}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Insert numbers', () => {
  const result = findDifference('hello', 'hello123');
  if (!result || result.type !== 'insert' || result.content !== '123' || result.position !== 5) {
    throw new Error(`Expected {type: 'insert', content: '123', position: 5}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Insert spaces', () => {
  const result = findDifference('hello', 'hello world');
  if (!result || result.type !== 'insert' || result.content !== ' world' || result.position !== 5) {
    throw new Error(`Expected {type: 'insert', content: ' world', position: 5}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Insert newlines', () => {
  const result = findDifference('hello', 'hello\nworld');
  if (!result || result.type !== 'insert' || result.content !== '\nworld' || result.position !== 5) {
    throw new Error(`Expected {type: 'insert', content: '\\nworld', position: 5}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Insert tabs', () => {
  const result = findDifference('hello', 'hello\tworld');
  if (!result || result.type !== 'insert' || result.content !== '\tworld' || result.position !== 5) {
    throw new Error(`Expected {type: 'insert', content: '\\tworld', position: 5}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Insert at very beginning of long text', () => {
  const result = findDifference('this is a long text', 'Xthis is a long text');
  if (!result || result.type !== 'insert' || result.content !== 'X' || result.position !== 0) {
    throw new Error(`Expected {type: 'insert', content: 'X', position: 0}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Insert at very end of long text', () => {
  const result = findDifference('this is a long text', 'this is a long textX');
  if (!result || result.type !== 'insert' || result.content !== 'X' || result.position !== 19) {
    throw new Error(`Expected {type: 'insert', content: 'X', position: 19}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Insert in middle of long text', () => {
  const result = findDifference('this is a long text', 'this is a Xlong text');
  if (!result || result.type !== 'insert' || result.content !== 'X' || result.position !== 10) {
    throw new Error(`Expected {type: 'insert', content: 'X', position: 10}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Insert multiple words', () => {
  const result = findDifference('hello', 'hello my friend');
  if (!result || result.type !== 'insert' || result.content !== ' my friend' || result.position !== 5) {
    throw new Error(`Expected {type: 'insert', content: ' my friend', position: 5}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Insert with Unicode characters', () => {
  const result = findDifference('hello', 'hello🌍');
  if (!result || result.type !== 'insert' || result.content !== '🌍' || result.position !== 5) {
    throw new Error(`Expected {type: 'insert', content: '🌍', position: 5}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Insert with mixed Unicode and ASCII', () => {
  const result = findDifference('hello', 'hello🌍world');
  if (!result || result.type !== 'insert' || result.content !== '🌍world' || result.position !== 5) {
    throw new Error(`Expected {type: 'insert', content: '🌍world', position: 5}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Insert single character at end of long text', () => {
  const oldText = "things and show them off! Im interested in creating tools that ";
  const newText = "things and show them off! Im interested in creating tools that p";
  const result = findDifference(oldText, newText);
  console.log(result)
  if (!result || result.type !== 'insert' || result.content !== 'p' || result.position !== oldText.length) {
    throw new Error(`Expected {type: 'insert', content: 'p', position: ${oldText.length}}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Insert at position 1', () => {
  const result = findDifference('hello', 'hXello');
  if (!result || result.type !== 'insert' || result.content !== 'X' || result.position !== 1) {
    throw new Error(`Expected {type: 'insert', content: 'X', position: 1}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Insert at position 2', () => {
  const result = findDifference('hello', 'heXllo');
  if (!result || result.type !== 'insert' || result.content !== 'X' || result.position !== 2) {
    throw new Error(`Expected {type: 'insert', content: 'X', position: 2}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Insert at position 3', () => {
  const result = findDifference('hello', 'helXlo');
  if (!result || result.type !== 'insert' || result.content !== 'X' || result.position !== 3) {
    throw new Error(`Expected {type: 'insert', content: 'X', position: 3}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Insert at position 4', () => {
  const result = findDifference('hello', 'hellXo');
  if (!result || result.type !== 'insert' || result.content !== 'X' || result.position !== 4) {
    throw new Error(`Expected {type: 'insert', content: 'X', position: 4}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Insert at position 5 (end)', () => {
  const result = findDifference('hello', 'helloX');
  if (!result || result.type !== 'insert' || result.content !== 'X' || result.position !== 5) {
    throw new Error(`Expected {type: 'insert', content: 'X', position: 5}, got ${JSON.stringify(result)}`);
  }
});

// Deletion test cases - Updated to expect FULL deleted content
console.log('\n🔍 Testing Deletion Logic...\n');

runner.test('Single character to empty', () => {
  const result = findDifference('a', '');
  if (!result || result.type !== 'delete' || result.content !== 'a' || result.position !== 0) {
    throw new Error(`Expected {type: 'delete', content: 'a', position: 0}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Multiple characters to empty', () => {
  const result = findDifference('hello', '');
  if (!result || result.type !== 'delete' || result.content !== 'hello' || result.position !== 0) {
    throw new Error(`Expected {type: 'delete', content: 'hello', position: 0}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Delete from end - single character', () => {
  const result = findDifference('hello', 'hell');
  if (!result || result.type !== 'delete' || result.content !== 'o' || result.position !== 4) {
    throw new Error(`Expected {type: 'delete', content: 'o', position: 4}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Delete from end - multiple characters', () => {
  const result = findDifference('hello', 'he');
  if (!result || result.type !== 'delete' || result.content !== 'llo' || result.position !== 2) {
    throw new Error(`Expected {type: 'delete', content: 'llo', position: 2}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Delete from beginning', () => {
  const result = findDifference('hello', 'ello');
  if (!result || result.type !== 'delete' || result.content !== 'h' || result.position !== 0) {
    throw new Error(`Expected {type: 'delete', content: 'h', position: 0}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Delete from middle - multiple characters', () => {
  const result = findDifference('hello', 'heo');
  if (!result || result.type !== 'delete' || result.content !== 'll' || result.position !== 2) {
    throw new Error(`Expected {type: 'delete', content: 'll', position: 2}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Delete at position 1', () => {
  const result = findDifference('hello', 'hllo');
  if (!result || result.type !== 'delete' || result.content !== 'e' || result.position !== 1) {
    throw new Error(`Expected {type: 'delete', content: 'e', position: 1}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Delete at position 4', () => {
  const result = findDifference('hello', 'hell');
  if (!result || result.type !== 'delete' || result.content !== 'o' || result.position !== 4) {
    throw new Error(`Expected {type: 'delete', content: 'o', position: 4}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Delete special characters', () => {
  const result = findDifference('hello!@#', 'hello');
  if (!result || result.type !== 'delete' || result.content !== '!@#' || result.position !== 5) {
    throw new Error(`Expected {type: 'delete', content: '!@#', position: 5}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Delete numbers', () => {
  const result = findDifference('hello123', 'hello');
  if (!result || result.type !== 'delete' || result.content !== '123' || result.position !== 5) {
    throw new Error(`Expected {type: 'delete', content: '123', position: 5}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Delete spaces', () => {
  const result = findDifference('hello world', 'hello');
  if (!result || result.type !== 'delete' || result.content !== ' world' || result.position !== 5) {
    throw new Error(`Expected {type: 'delete', content: ' world', position: 5}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Delete newlines', () => {
  const result = findDifference('hello\nworld', 'hello');
  if (!result || result.type !== 'delete' || result.content !== '\nworld' || result.position !== 5) {
    throw new Error(`Expected {type: 'delete', content: '\\nworld', position: 5}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Delete tabs', () => {
  const result = findDifference('hello\tworld', 'hello');
  if (!result || result.type !== 'delete' || result.content !== '\tworld' || result.position !== 5) {
    throw new Error(`Expected {type: 'delete', content: '\\tworld', position: 5}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Delete from very beginning of long text', () => {
  const result = findDifference('Xthis is a long text', 'this is a long text');
  if (!result || result.type !== 'delete' || result.content !== 'X' || result.position !== 0) {
    throw new Error(`Expected {type: 'delete', content: 'X', position: 0}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Delete from very end of long text', () => {
  const result = findDifference('this is a long textX', 'this is a long text');
  if (!result || result.type !== 'delete' || result.content !== 'X' || result.position !== 19) {
    throw new Error(`Expected {type: 'delete', content: 'X', position: 19}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Delete from middle of long text', () => {
  const result = findDifference('this is a Xlong text', 'this is a long text');
  if (!result || result.type !== 'delete' || result.content !== 'X' || result.position !== 10) {
    throw new Error(`Expected {type: 'delete', content: 'X', position: 10}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Delete multiple words', () => {
  const result = findDifference('hello my friend', 'hello');
  if (!result || result.type !== 'delete' || result.content !== ' my friend' || result.position !== 5) {
    throw new Error(`Expected {type: 'delete', content: ' my friend', position: 5}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Delete with Unicode characters', () => {
  const result = findDifference('hello🌍', 'hello');
  if (!result || result.type !== 'delete' || result.content !== '🌍' || result.position !== 5) {
    throw new Error(`Expected {type: 'delete', content: '🌍', position: 5}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Delete with mixed Unicode and ASCII', () => {
  const result = findDifference('hello🌍world', 'hello');
  if (!result || result.type !== 'delete' || result.content !== '🌍world' || result.position !== 5) {
    throw new Error(`Expected {type: 'delete', content: '🌍world', position: 5}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Delete first word', () => {
  const result = findDifference('hello world', 'world');
  if (!result || result.type !== 'delete' || result.content !== 'hello ' || result.position !== 0) {
    throw new Error(`Expected {type: 'delete', content: 'hello ', position: 0}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Delete last word', () => {
  const result = findDifference('hello world', 'hello');
  if (!result || result.type !== 'delete' || result.content !== ' world' || result.position !== 5) {
    throw new Error(`Expected {type: 'delete', content: ' world', position: 5}, got ${JSON.stringify(result)}`);
  }
});

// Additional comprehensive deletion tests
runner.test('Delete entire text to empty', () => {
  const result = findDifference('hello world', '');
  if (!result || result.type !== 'delete' || result.content !== 'hello world' || result.position !== 0) {
    throw new Error(`Expected {type: 'delete', content: 'hello world', position: 0}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Delete multiple characters from beginning', () => {
  const result = findDifference('hello world', 'world');
  if (!result || result.type !== 'delete' || result.content !== 'hello ' || result.position !== 0) {
    throw new Error(`Expected {type: 'delete', content: 'hello ', position: 0}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Delete multiple characters from end', () => {
  const result = findDifference('hello world', 'hello');
  if (!result || result.type !== 'delete' || result.content !== ' world' || result.position !== 5) {
    throw new Error(`Expected {type: 'delete', content: ' world', position: 5}, got ${JSON.stringify(result)}`);
  }
});

runner.test('Delete with mixed content', () => {
  const result = findDifference('hello123!@#world', 'hello');
  if (!result || result.type !== 'delete' || result.content !== '123!@#world' || result.position !== 5) {
    throw new Error(`Expected {type: 'delete', content: '123!@#world', position: 5}, got ${JSON.stringify(result)}`);
  }
});

// Edge cases
runner.test('Same text (no change)', () => {
  const result = findDifference('hello', 'hello');
  if (result !== null) {
    throw new Error(`Expected null for identical strings, got ${JSON.stringify(result)}`);
  }
});

runner.test('Empty to empty', () => {
  const result = findDifference('', '');
  if (result !== null) {
    throw new Error(`Expected null for empty strings, got ${JSON.stringify(result)}`);
  }
});

// Run all tests
runner.run();
