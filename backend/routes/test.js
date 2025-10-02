// Backend Test Runner API
// Allows running tests from admin panel

const { Router } = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const { authRequired } = require('../mw/auth');
const execAsync = promisify(exec);

const router = Router();

// Middleware to check if user is admin
function adminRequired(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ ok: false, error: 'admin_required' });
  }
  next();
}

// GET /api/test/status - Check if tests are available
router.get('/status', authRequired, adminRequired, async (req, res) => {
  try {
    // Check if Jest is installed
    const { stdout } = await execAsync('npx jest --version');
    const version = stdout.trim();

    res.json({
      ok: true,
      available: true,
      jest_version: version,
      node_env: process.env.NODE_ENV
    });
  } catch (error) {
    res.json({
      ok: true,
      available: false,
      error: error.message
    });
  }
});

// GET /api/test/list - List available test files
router.get('/list', authRequired, adminRequired, async (req, res) => {
  try {
    const { stdout } = await execAsync('npx jest --listTests');
    const tests = stdout.trim().split('\n').filter(t => t);

    res.json({
      ok: true,
      tests: tests.map(test => {
        const parts = test.split(/[\\/]/);
        const filename = parts[parts.length - 1];
        const category = parts.includes('unit') ? 'unit' :
                        parts.includes('integration') ? 'integration' :
                        parts.includes('api') ? 'api' : 'other';

        return {
          path: test,
          filename,
          category
        };
      })
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// POST /api/test/run - Run tests (simplified - just run npm test)
router.post('/run', authRequired, adminRequired, (req, res) => {
  const { type = 'all', pattern } = req.body;

  // Build Jest command with pattern
  let command = 'npx jest --json';

  // Add pattern if specified
  if (type === 'unit') {
    command += ' --testPathPattern=unit';
  } else if (type === 'integration') {
    command += ' --testPathPattern=integration';
  } else if (type === 'api') {
    command += ' --testPathPattern=api';
  } else if (pattern) {
    command += ` --testPathPattern=${pattern}`;
  }

  console.log('🧪 Running command:', command);

  // Use exec with callback - capture stdout directly
  exec(command, {
    timeout: 60000,
    maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large test outputs
    encoding: 'utf8',
    shell: true
  }, (error, stdout, stderr) => {
    console.log('🧪 Command completed');
    console.log('🧪 Error:', error ? 'YES' : 'NO');
    console.log('🧪 stdout length:', stdout?.length || 0);
    console.log('🧪 stderr length:', stderr?.length || 0);

    // On Windows with --json, Jest writes to stdout but exec doesn't capture it properly
    // Write stdout to file for debugging
    if (stdout) {
      try {
        fs.writeFileSync('test-stdout.txt', stdout);
        console.log('🧪 Wrote stdout to test-stdout.txt');
      } catch (e) {
        console.log('🧪 Failed to write stdout file:', e.message);
      }
    }

    let jsonContent = stdout;

    if (!jsonContent || jsonContent.trim().length === 0) {
      console.log('🧪 stdout empty, returning error');
      return res.json({
        ok: true,
        results: {
          success: false,
          error: 'No JSON output from Jest. Check console logs.',
          raw: stderr?.substring(0, 500)
        }
      });
    }

    let results;
    try {
      results = JSON.parse(jsonContent);
      console.log('🧪 Parsed JSON successfully');
    } catch (parseError) {
      // If JSON parsing fails, return raw output
      console.log('🧪 Failed to parse JSON:', parseError.message);
      return res.json({
        ok: true,
        results: {
          success: false,
          numTotalTests: 0,
          numPassedTests: 0,
          numFailedTests: 0,
          testResults: [],
          error: 'Failed to parse test output: ' + parseError.message,
          raw: jsonContent.substring(0, 1000) // First 1KB for debugging
        }
      });
    }

    console.log('🧪 Transforming test results, files:', results.testResults?.length || 0);

    const transformedResults = results.testResults.map(testFile => {
      const assertions = testFile.assertionResults || [];
      const transformed = {
        name: testFile.name.split(/[\\/]/).pop(),
        status: testFile.status,
        numTests: assertions.length,
        numPassed: assertions.filter(t => t.status === 'passed').length,
        numFailed: assertions.filter(t => t.status === 'failed').length,
        tests: assertions.map(test => ({
          title: test.title || test.ancestorTitles?.join(' > ') || 'Unknown test',
          fullName: test.fullName,
          status: test.status,
          duration: test.duration,
          failureMessages: test.failureMessages
        }))
      };
      console.log('🧪 Transformed file:', transformed.name, 'passed:', transformed.numPassed, 'failed:', transformed.numFailed);
      return transformed;
    });

    res.json({
      ok: true,
      results: {
        success: results.success,
        numTotalTests: results.numTotalTests,
        numPassedTests: results.numPassedTests,
        numFailedTests: results.numFailedTests,
        numPendingTests: results.numPendingTests,
        testResults: transformedResults
      }
    });
  });
});

// POST /api/test/coverage - Run tests with coverage
router.post('/coverage', authRequired, adminRequired, async (req, res) => {
  try {
    const { stdout, stderr } = await execAsync('npx jest --coverage --json', { timeout: 120000 });

    let results;
    try {
      results = JSON.parse(stdout);
    } catch {
      return res.json({
        ok: true,
        coverage: null,
        error: 'Could not parse coverage data'
      });
    }

    res.json({
      ok: true,
      coverage: results.coverageMap || null,
      summary: {
        success: results.success,
        numTotalTests: results.numTotalTests,
        numPassedTests: results.numPassedTests,
        numFailedTests: results.numFailedTests
      }
    });
  } catch (error) {
    res.json({
      ok: false,
      error: error.message
    });
  }
});

module.exports = router;