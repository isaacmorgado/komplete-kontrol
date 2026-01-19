/**
 * Skills System Integration Test
 *
 * This script should be run in the renderer process (DevTools console or browser console)
 * when the Komplete-Kontrol app is running.
 *
 * Instructions:
 * 1. Start the app: npm run dev
 * 2. Open DevTools (Cmd+Option+I on Mac, Ctrl+Shift+I on Windows/Linux)
 * 3. Go to Console tab
 * 4. Copy and paste this entire script
 * 5. Run it
 */

async function testSkillsSystem() {
  console.log('🚀 Starting Skills System Integration Tests\n');
  console.log('='.repeat(60));

  const tests = [];
  let allPassed = true;

  // Test 1: Check if komplete API exists
  console.log('\n🧪 Test 1: Check komplete API exists');
  if (typeof window !== 'undefined' && window.komplete && window.komplete.skills) {
    console.log('✅ window.komplete.skills API is available');
    tests.push({ name: 'API Available', passed: true });
  } else {
    console.error('❌ window.komplete.skills API not found');
    console.error('Make sure the app is running and the preload script has loaded');
    allPassed = false;
    tests.push({ name: 'API Available', passed: false });
    return; // Can't continue without API
  }

  // Test 2: List all skills
  console.log('\n🧪 Test 2: List all skills');
  try {
    const skills = await window.komplete.skills.list();
    console.log(`✅ Retrieved ${skills.length} skills:`);
    skills.forEach(skill => {
      console.log(`   - ${skill.name} (${skill.source}${skill.mode ? ', mode: ' + skill.mode : ''})`);
    });
    tests.push({ name: 'List Skills', passed: true, count: skills.length });
  } catch (error) {
    console.error('❌ Failed to list skills:', error.message);
    allPassed = false;
    tests.push({ name: 'List Skills', passed: false, error: error.message });
  }

  // Test 3: Get specific skill
  console.log('\n🧪 Test 3: Get specific skill');
  try {
    const skill = await window.komplete.skills.get('react-debugging');
    if (skill) {
      console.log('✅ Retrieved skill:', skill.name);
      console.log('   Description:', skill.description);
      console.log('   Instructions length:', skill.instructions.length, 'chars');
      tests.push({ name: 'Get Skill', passed: true, skill: skill.name });
    } else {
      console.error('❌ Skill not found');
      allPassed = false;
      tests.push({ name: 'Get Skill', passed: false, error: 'Skill not found' });
    }
  } catch (error) {
    console.error('❌ Failed to get skill:', error.message);
    allPassed = false;
    tests.push({ name: 'Get Skill', passed: false, error: error.message });
  }

  // Test 4: List skills for specific mode
  console.log('\n🧪 Test 4: List skills for code mode');
  try {
    const codeSkills = await window.komplete.skills.list('code');
    console.log(`✅ Retrieved ${codeSkills.length} skills for code mode:`);
    codeSkills.forEach(skill => {
      console.log(`   - ${skill.name}`);
    });
    tests.push({ name: 'List Mode Skills', passed: true, count: codeSkills.length });
  } catch (error) {
    console.error('❌ Failed to list code mode skills:', error.message);
    allPassed = false;
    tests.push({ name: 'List Mode Skills', passed: false, error: error.message });
  }

  // Test 5: Verify skill structure
  console.log('\n🧪 Test 5: Verify skill structure');
  try {
    const skills = await window.komplete.skills.list();
    if (skills.length > 0) {
      const skill = skills[0];
      const requiredFields = ['name', 'description', 'path', 'source'];
      const hasAllFields = requiredFields.every(field => field in skill);

      if (hasAllFields) {
        console.log('✅ Skill has all required fields:', requiredFields.join(', '));
        tests.push({ name: 'Skill Structure', passed: true });
      } else {
        const missing = requiredFields.filter(field => !(field in skill));
        console.error('❌ Skill missing fields:', missing.join(', '));
        allPassed = false;
        tests.push({ name: 'Skill Structure', passed: false, error: 'Missing fields: ' + missing.join(', ') });
      }
    } else {
      console.error('❌ No skills to verify');
      allPassed = false;
      tests.push({ name: 'Skill Structure', passed: false, error: 'No skills found' });
    }
  } catch (error) {
    console.error('❌ Failed to verify skill structure:', error.message);
    allPassed = false;
    tests.push({ name: 'Skill Structure', passed: false, error: error.message });
  }

  // Test 6: Get skill content
  console.log('\n🧪 Test 6: Get skill content with instructions');
  try {
    const skill = await window.komplete.skills.get('git-workflow');
    if (skill && skill.instructions) {
      const preview = skill.instructions.substring(0, 100);
      console.log('✅ Retrieved skill with instructions:');
      console.log('   Preview:', preview + '...');
      tests.push({ name: 'Skill Content', passed: true, instructionsLength: skill.instructions.length });
    } else {
      console.error('❌ Skill instructions not found');
      allPassed = false;
      tests.push({ name: 'Skill Content', passed: false, error: 'No instructions' });
    }
  } catch (error) {
    console.error('❌ Failed to get skill content:', error.message);
    allPassed = false;
    tests.push({ name: 'Skill Content', passed: false, error: error.message });
  }

  // Test 7: Reload skills
  console.log('\n🧪 Test 7: Reload skills');
  try {
    await window.komplete.skills.reload();
    console.log('✅ Skills reloaded successfully');
    tests.push({ name: 'Reload Skills', passed: true });
  } catch (error) {
    console.error('❌ Failed to reload skills:', error.message);
    allPassed = false;
    tests.push({ name: 'Reload Skills', passed: false, error: error.message });
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Results Summary\n');

  const passed = tests.filter(t => t.passed).length;
  const total = tests.length;
  const percentage = Math.round((passed / total) * 100);

  tests.forEach(test => {
    if (test.passed) {
      console.log(`✅ ${test.name}`);
      if (test.count !== undefined) console.log(`   Count: ${test.count}`);
      if (test.skill) console.log(`   Skill: ${test.skill}`);
      if (test.instructionsLength) console.log(`   Instructions length: ${test.instructionsLength}`);
    } else {
      console.log(`❌ ${test.name}`);
      if (test.error) console.log(`   Error: ${test.error}`);
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log(`\n📈 Overall: ${passed}/${total} tests passed (${percentage}%)\n`);

  if (allPassed) {
    console.log('✅ All integration tests passed! Skills system is working correctly.\n');
  } else {
    console.error(`❌ ${total - passed} test(s) failed. Please review the errors above.\n`);
  }

  return {
    allPassed,
    passed,
    total,
    percentage,
    tests
  };
}

// Run the tests
testSkillsSystem().then(results => {
  // Return results for further inspection
  console.log('Test results stored in variable: testResults');
  window.testResults = results;
});
