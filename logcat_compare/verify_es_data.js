#!/usr/bin/env node

/**
 * 验证 Elasticsearch 中的数据
 */

const { Client } = require('@elastic/elasticsearch');

async function verifyData() {
  console.log('验证 Elasticsearch 中的数据...\n');
  
  // 创建客户端（使用与主脚本相同的配置）
  const client = new Client({
    node: 'https://127.0.0.1:9200',
    auth: {
      username: 'elastic',
      password: '123456'
    },
    tls: {
      rejectUnauthorized: false
    }
  });
  
  try {
    // 1. 检查集群健康状态
    console.log('1. 检查集群健康状态:');
    const health = await client.cluster.health();
    console.log(`   状态: ${health.status}`);
    console.log(`   节点数: ${health.number_of_nodes}`);
    console.log(`   分片数: ${health.active_shards}`);
    console.log('');
    
    // 2. 列出所有索引
    console.log('2. 列出所有索引:');
    const indices = await client.cat.indices({ format: 'json' });
    indices.forEach(index => {
      console.log(`   - ${index.index}: ${index['docs.count']} 个文档, 大小: ${index['store.size']}`);
    });
    console.log('');
    
    // 3. 检查 test_sample 索引
    console.log('3. 检查 test_sample 索引:');
    const indexExists = await client.indices.exists({ index: 'test_sample' });
    if (indexExists) {
      const indexStats = await client.indices.stats({ index: 'test_sample' });
      const docCount = indexStats.indices['test_sample'].total.docs.count;
      console.log(`   索引存在, 文档数: ${docCount}`);
      
      // 4. 获取索引中的文档
      if (docCount > 0) {
        console.log('\n4. 获取索引中的文档:');
        const searchResult = await client.search({
          index: 'test_sample',
          size: 5,
          body: {
            query: {
              match_all: {}
            }
          }
        });
        
        console.log(`   找到 ${searchResult.hits.total.value} 个文档:`);
        searchResult.hits.hits.forEach((hit, i) => {
          console.log(`\n   文档 ${i + 1} (ID: ${hit._id}):`);
          console.log(`     - 文件名: ${hit._source.filename}`);
          console.log(`     - 时间戳: ${hit._source.timestamp}`);
          console.log(`     - 级别: ${hit._source.level}`);
          console.log(`     - 标签: ${hit._source.tag}`);
          console.log(`     - PID: ${hit._source.pid}`);
          console.log(`     - 消息: ${hit._source.message ? hit._source.message.substring(0, 50) + '...' : '无'}`);
          console.log(`     - 解析时间: ${hit._source.parsed_at}`);
        });
      } else {
        console.log('   索引中没有文档');
      }
    } else {
      console.log('   test_sample 索引不存在');
    }
    
    console.log('\n✅ 验证完成!');
    
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
    process.exit(1);
  }
}

// 运行验证函数
if (require.main === module) {
  verifyData().catch(error => {
    console.error('未处理的错误:', error);
    process.exit(1);
  });
}

module.exports = verifyData;
