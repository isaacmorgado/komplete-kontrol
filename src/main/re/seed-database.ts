/**
 * RE Database Seeder
 * Populates database with tools and workflows from knowledge base
 */

import { getREDatabase, RETool, REWorkflow } from './re-database';
import { RETargetType } from './intent-parser';
import fs from 'fs';
import path from 'path';

export class DatabaseSeeder {
  private db = getREDatabase();

  /**
   * Seed database with essential tools and workflows
   */
  async seed(): Promise<void> {
    console.log('🌱 Seeding RE database...');

    // Seed essential tools
    await this.seedTools();

    // Seed common workflows
    await this.seedWorkflows();

    console.log('✅ Database seeding complete');
  }

  /**
   * Seed essential RE tools
   */
  private async seedTools(): Promise<void> {
    const tools: RETool[] = [
      // Binary Analysis Tools
      {
        id: 'ghidra',
        name: 'Ghidra',
        category: RETargetType.BINARY_EXECUTABLE,
        subcategory: 'disassembler',
        binary_name: 'ghidraRun',
        install_method: 'homebrew',
        install_command: 'brew install ghidra',
        version_command: 'ghidra -version',
        capabilities: ['disassembly', 'decompilation', 'static-analysis', 'deep-analysis'],
        dependencies: ['java'],
        performance_score: 0.8,
        reliability_score: 0.95,
        popularity_score: 0.9,
        cost: 'free',
        platforms: ['macos', 'linux', 'windows'],
        documentation_url: 'https://ghidra-sre.org/',
        github_url: 'https://github.com/NationalSecurityAgency/ghidra'
      },
      {
        id: 'radare2',
        name: 'Radare2',
        category: RETargetType.BINARY_EXECUTABLE,
        subcategory: 'disassembler',
        binary_name: 'r2',
        install_method: 'homebrew',
        install_command: 'brew install radare2',
        version_command: 'r2 -version',
        capabilities: ['disassembly', 'debugging', 'binary-patching', 'quick-scan'],
        performance_score: 0.9,
        reliability_score: 0.85,
        popularity_score: 0.85,
        cost: 'free',
        platforms: ['macos', 'linux', 'windows'],
        documentation_url: 'https://rada.re/n/radare2.html',
        github_url: 'https://github.com/radareorg/radare2'
      },
      {
        id: 'angr',
        name: 'angr',
        category: RETargetType.BINARY_EXECUTABLE,
        subcategory: 'symbolic-execution',
        binary_name: 'python3',
        install_method: 'pip',
        install_command: 'pip3 install angr',
        capabilities: ['symbolic-execution', 'deep-analysis', 'vulnerability-discovery'],
        dependencies: ['python3'],
        performance_score: 0.7,
        reliability_score: 0.8,
        popularity_score: 0.75,
        cost: 'free',
        platforms: ['macos', 'linux', 'windows'],
        documentation_url: 'https://docs.angr.io/',
        github_url: 'https://github.com/angr/angr'
      },

      // Mobile Analysis Tools
      {
        id: 'apktool',
        name: 'APKTool',
        category: RETargetType.MOBILE_APP,
        subcategory: 'decoder',
        binary_name: 'apktool',
        install_method: 'homebrew',
        install_command: 'brew install apktool',
        version_command: 'apktool -version',
        capabilities: ['decompilation', 'resource-extraction', 'repackaging'],
        performance_score: 0.95,
        reliability_score: 0.95,
        popularity_score: 0.95,
        cost: 'free',
        platforms: ['macos', 'linux', 'windows'],
        documentation_url: 'https://ibotpeaches.github.io/Apktool/',
        github_url: 'https://github.com/iBotPeaches/Apktool',
        metadata: { platform: 'android' }
      },
      {
        id: 'frida',
        name: 'Frida',
        category: RETargetType.MOBILE_APP,
        subcategory: 'instrumentation',
        binary_name: 'frida',
        install_method: 'pip',
        install_command: 'pip3 install frida-tools',
        version_command: 'frida --version',
        capabilities: ['dynamic-analysis', 'instrumentation', 'hooking', 'deep-analysis'],
        dependencies: ['python3'],
        performance_score: 0.9,
        reliability_score: 0.9,
        popularity_score: 0.95,
        cost: 'free',
        platforms: ['macos', 'linux', 'windows', 'ios', 'android'],
        documentation_url: 'https://frida.re/',
        github_url: 'https://github.com/frida/frida',
        metadata: { platform: 'android' }
      },
      {
        id: 'mobsf',
        name: 'MobSF',
        category: RETargetType.MOBILE_APP,
        subcategory: 'security-framework',
        binary_name: 'python3',
        install_method: 'github',
        install_command: 'git clone https://github.com/MobSF/Mobile-Security-Framework-MobSF',
        capabilities: ['static-analysis', 'dynamic-analysis', 'malware-detection', 'deep-analysis'],
        dependencies: ['python3', 'docker'],
        performance_score: 0.85,
        reliability_score: 0.9,
        popularity_score: 0.9,
        cost: 'free',
        platforms: ['macos', 'linux', 'windows'],
        documentation_url: 'https://mobsf.github.io/docs/',
        github_url: 'https://github.com/MobSF/Mobile-Security-Framework-MobSF'
      },

      // Network/API Tools
      {
        id: 'mitmproxy',
        name: 'mitmproxy',
        category: RETargetType.NETWORK_API,
        subcategory: 'proxy',
        binary_name: 'mitmproxy',
        install_method: 'homebrew',
        install_command: 'brew install mitmproxy',
        version_command: 'mitmproxy --version',
        capabilities: ['traffic-interception', 'https-decryption', 'request-modification'],
        performance_score: 0.9,
        reliability_score: 0.95,
        popularity_score: 0.9,
        cost: 'free',
        platforms: ['macos', 'linux', 'windows'],
        documentation_url: 'https://docs.mitmproxy.org/',
        github_url: 'https://github.com/mitmproxy/mitmproxy'
      },
      {
        id: 'zaproxy',
        name: 'OWASP ZAP',
        category: RETargetType.NETWORK_API,
        subcategory: 'security-scanner',
        binary_name: 'zap.sh',
        install_method: 'homebrew',
        install_command: 'brew install --cask owasp-zap',
        capabilities: ['vulnerability-scanning', 'api-testing', 'fuzzing', 'deep-analysis'],
        performance_score: 0.85,
        reliability_score: 0.9,
        popularity_score: 0.95,
        cost: 'free',
        platforms: ['macos', 'linux', 'windows'],
        documentation_url: 'https://www.zaproxy.org/docs/',
        github_url: 'https://github.com/zaproxy/zaproxy'
      },

      // Web/Browser Tools
      {
        id: 'playwright',
        name: 'Playwright',
        category: RETargetType.WEB_BROWSER,
        subcategory: 'automation',
        binary_name: 'npx',
        install_method: 'npm',
        install_command: 'npm install -D @playwright/test',
        capabilities: ['browser-automation', 'network-monitoring', 'screenshot-capture'],
        dependencies: ['node'],
        performance_score: 0.95,
        reliability_score: 0.95,
        popularity_score: 0.9,
        cost: 'free',
        platforms: ['macos', 'linux', 'windows'],
        documentation_url: 'https://playwright.dev/',
        github_url: 'https://github.com/microsoft/playwright'
      },
      {
        id: 'restringer',
        name: 'Restringer',
        category: RETargetType.WEB_BROWSER,
        subcategory: 'deobfuscator',
        binary_name: 'node',
        install_method: 'npm',
        install_command: 'npm install -g @restringer/restringer',
        capabilities: ['deobfuscation', 'ast-analysis', 'code-beautification'],
        dependencies: ['node'],
        performance_score: 0.9,
        reliability_score: 0.85,
        popularity_score: 0.7,
        cost: 'free',
        platforms: ['macos', 'linux', 'windows'],
        documentation_url: 'https://github.com/PerimeterX/restringer',
        github_url: 'https://github.com/PerimeterX/restringer'
      },

      // Cloud/Container Tools
      {
        id: 'trivy',
        name: 'Trivy',
        category: RETargetType.CLOUD_CONTAINER,
        subcategory: 'scanner',
        binary_name: 'trivy',
        install_method: 'homebrew',
        install_command: 'brew install trivy',
        version_command: 'trivy --version',
        capabilities: ['vulnerability-scanning', 'container-analysis', 'iac-scanning'],
        performance_score: 0.95,
        reliability_score: 0.95,
        popularity_score: 0.9,
        cost: 'free',
        platforms: ['macos', 'linux', 'windows'],
        documentation_url: 'https://aquasecurity.github.io/trivy/',
        github_url: 'https://github.com/aquasecurity/trivy'
      },

      // AI/ML Tools
      {
        id: 'netron',
        name: 'Netron',
        category: RETargetType.AI_ML_MODEL,
        subcategory: 'visualizer',
        binary_name: 'netron',
        install_method: 'homebrew',
        install_command: 'brew install --cask netron',
        capabilities: ['model-visualization', 'architecture-analysis', 'weight-inspection'],
        performance_score: 0.95,
        reliability_score: 0.95,
        popularity_score: 0.85,
        cost: 'free',
        platforms: ['macos', 'linux', 'windows'],
        documentation_url: 'https://github.com/lutzroeder/netron',
        github_url: 'https://github.com/lutzroeder/netron'
      }
    ];

    for (const tool of tools) {
      this.db.insertTool(tool);
      console.log(`  ✓ Added tool: ${tool.name}`);
    }
  }

  /**
   * Seed common workflows
   */
  private async seedWorkflows(): Promise<void> {
    const workflows: REWorkflow[] = [
      {
        id: 'android-apk-analysis',
        name: 'Android APK Analysis',
        description: 'Complete analysis of Android APK files',
        target_type: RETargetType.MOBILE_APP,
        difficulty: 'moderate',
        tool_chain: ['apktool', 'frida', 'mobsf'],
        parallel_steps: [[0], [1, 2]], // apktool first, then frida + mobsf in parallel
        estimated_duration: 600, // 10 minutes
        success_rate: 0.95,
        usage_count: 0,
        tags: ['android', 'mobile', 'apk']
      },
      {
        id: 'binary-malware-analysis',
        name: 'Binary Malware Analysis',
        description: 'Deep analysis of potentially malicious binaries',
        target_type: RETargetType.BINARY_EXECUTABLE,
        difficulty: 'deep',
        tool_chain: ['ghidra', 'radare2', 'angr'],
        parallel_steps: [[0, 1], [2]], // ghidra + radare2 in parallel, then angr
        estimated_duration: 1800, // 30 minutes
        success_rate: 0.85,
        usage_count: 0,
        tags: ['malware', 'binary', 'deep-analysis']
      },
      {
        id: 'api-reconnaissance',
        name: 'API Reconnaissance',
        description: 'Discover and analyze API endpoints',
        target_type: RETargetType.NETWORK_API,
        difficulty: 'moderate',
        tool_chain: ['mitmproxy', 'zaproxy'],
        parallel_steps: [[0], [1]],
        estimated_duration: 900, // 15 minutes
        success_rate: 0.9,
        usage_count: 0,
        tags: ['api', 'network', 'recon']
      },
      {
        id: 'web-app-analysis',
        name: 'Web Application Analysis',
        description: 'Analyze web application structure and behavior',
        target_type: RETargetType.WEB_BROWSER,
        difficulty: 'surface',
        tool_chain: ['playwright', 'restringer'],
        parallel_steps: [[0], [1]],
        estimated_duration: 300, // 5 minutes
        success_rate: 0.9,
        usage_count: 0,
        tags: ['web', 'javascript', 'browser']
      },
      {
        id: 'container-security-scan',
        name: 'Container Security Scan',
        description: 'Scan Docker containers for vulnerabilities',
        target_type: RETargetType.CLOUD_CONTAINER,
        difficulty: 'surface',
        tool_chain: ['trivy'],
        parallel_steps: [[0]],
        estimated_duration: 120, // 2 minutes
        success_rate: 0.95,
        usage_count: 0,
        tags: ['docker', 'container', 'security']
      },
      {
        id: 'ml-model-inspection',
        name: 'ML Model Inspection',
        description: 'Inspect and analyze machine learning model architecture',
        target_type: RETargetType.AI_ML_MODEL,
        difficulty: 'moderate',
        tool_chain: ['netron'],
        parallel_steps: [[0]],
        estimated_duration: 180, // 3 minutes
        success_rate: 0.95,
        usage_count: 0,
        tags: ['ml', 'ai', 'model']
      }
    ];

    for (const workflow of workflows) {
      this.db.insertWorkflow(workflow);
      console.log(`  ✓ Added workflow: ${workflow.name}`);
    }
  }

  /**
   * Import tools from knowledge base JSON
   */
  async importFromKnowledgeBase(knowledgeBasePath: string): Promise<void> {
    const toolEncyclopediaPath = path.join(knowledgeBasePath, 'tool-encyclopedia.json');

    if (!fs.existsSync(toolEncyclopediaPath)) {
      console.warn('Tool encyclopedia not found at:', toolEncyclopediaPath);
      return;
    }

    const data = JSON.parse(fs.readFileSync(toolEncyclopediaPath, 'utf-8'));
    const tools = data.tools || {};

    let imported = 0;
    for (const [toolId, toolData] of Object.entries(tools)) {
      try {
        const tool = this.convertKnowledgeBaseTool(toolId, toolData as any);
        this.db.insertTool(tool);
        imported++;
      } catch (error) {
        console.error(`Failed to import tool ${toolId}:`, error);
      }
    }

    console.log(`✅ Imported ${imported} tools from knowledge base`);
  }

  private convertKnowledgeBaseTool(id: string, data: any): RETool {
    // Map knowledge base format to database format
    const categoryMap: Record<string, RETargetType> = {
      'binary_analysis': RETargetType.BINARY_EXECUTABLE,
      'mobile_analysis': RETargetType.MOBILE_APP,
      'web_analysis': RETargetType.WEB_BROWSER,
      'network_analysis': RETargetType.NETWORK_API,
      'cloud_analysis': RETargetType.CLOUD_CONTAINER
    };

    return {
      id,
      name: data.name,
      category: categoryMap[data.category] || RETargetType.BINARY_EXECUTABLE,
      subcategory: data.subcategory,
      capabilities: data.capabilities || [],
      platforms: data.platforms?.map((p: string) => p.toLowerCase()) || [],
      documentation_url: data.installation?.url,
      github_url: data.github,
      cost: data.cost || 'free',
      performance_score: data.learning_curve === 'low' ? 0.9 : data.learning_curve === 'high' ? 0.7 : 0.8,
      reliability_score: 0.85,
      popularity_score: data.alternatives?.length > 0 ? 0.9 : 0.7,
      install_method: data.installation?.method,
      install_command: data.installation?.package_managers?.[0]
        ? `${data.installation.package_managers[0]} install ${id}`
        : undefined,
      metadata: data
    };
  }
}

// CLI entry point for seeding
if (require.main === module) {
  const seeder = new DatabaseSeeder();

  (async () => {
    try {
      // Seed essential tools and workflows
      await seeder.seed();

      // Import from knowledge base if available
      const knowledgeBasePath = path.join(__dirname, '../../../..', 'knowledge-base');
      if (fs.existsSync(knowledgeBasePath)) {
        console.log('\n📚 Importing from knowledge base...');
        await seeder.importFromKnowledgeBase(knowledgeBasePath);
      }

      const stats = getREDatabase().getStats();
      console.log(`\n📊 Database stats: ${stats.tools} tools, ${stats.workflows} workflows`);
    } catch (error) {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    }
  })();
}
