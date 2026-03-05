/**
 * Elasticsearch 客户端模块
 * 用于连接 Elasticsearch 并执行索引操作
 */

const { Client } = require('@elastic/elasticsearch');

class ElasticsearchClient {
  constructor(options = {}) {
    // 默认连接到本地 Elasticsearch (使用 HTTPS)
    const defaultAuth = options.username && options.password 
      ? { username: options.username, password: options.password }
      : undefined;
    
    // 默认 TLS 配置（跳过证书验证，用于自签名证书）
    const defaultTls = options.tls || {
      rejectUnauthorized: false  // 跳过证书验证
    };
    
    this.client = new Client({
      node: options.node || 'https://127.0.0.1:9200',
      auth: options.auth || defaultAuth,
      tls: defaultTls,
      ...options
    });
    
    this.connected = false;
  }

  /**
   * 测试 Elasticsearch 连接
   */
  async testConnection() {
    try {
      const response = await this.client.ping();
      this.connected = true;
      console.log('✅ Elasticsearch 连接成功');
      return true;
    } catch (error) {
      console.error('❌ Elasticsearch 连接失败:', error.message);
      this.connected = false;
      return false;
    }
  }

  /**
   * 创建索引（如果不存在）
   * @param {string} indexName - 索引名称
   * @param {Object} mappings - 索引映射
   */
  async createIndexIfNotExists(indexName, mappings = null) {
    try {
      const exists = await this.client.indices.exists({ index: indexName });
      
      if (!exists) {
        const body = mappings ? { mappings } : {};
        await this.client.indices.create({
          index: indexName,
          body
        });
        console.log(`✅ 创建索引: ${indexName}`);
      } else {
        console.log(`ℹ️  索引已存在: ${indexName}`);
      }
      
      return true;
    } catch (error) {
      console.error(`❌ 创建索引失败 (${indexName}):`, error.message);
      return false;
    }
  }

  /**
   * 清理索引名称（移除特殊字符）
   * @param {string} filename - 原始文件名
   * @returns {string} 清理后的索引名称
   */
  sanitizeIndexName(filename) {
    // 移除路径和扩展名，只保留文件名
    const name = filename.replace(/^.*[\\\/]/, '').replace(/\.[^/.]+$/, '');
    
    // 替换特殊字符为下划线，只允许小写字母、数字、下划线、连字符
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  /**
   * 批量索引文档
   * @param {string} indexName - 索引名称
   * @param {Array} documents - 文档数组
   * @param {string} idField - 用作文档ID的字段名
   */
  async bulkIndex(indexName, documents, idField = null) {
    if (!documents || documents.length === 0) {
      console.log('⚠️  没有文档需要索引');
      return { success: true, count: 0 };
    }

    const body = [];
    
    documents.forEach(doc => {
      // 添加索引操作
      const indexOp = {
        index: {
          _index: indexName,
        }
      };
      
      // 如果指定了ID字段，使用它作为文档ID
      if (idField && doc[idField]) {
        indexOp.index._id = String(doc[idField]);
      }
      
      body.push(indexOp);
      body.push(doc);
    });

    try {
      const response = await this.client.bulk({ refresh: true, body });
      
      if (response.errors) {
        const errors = response.items.filter(item => item.index.error);
        console.error(`❌ 批量索引部分失败: ${errors.length} 个错误`);
        
        // 打印前几个错误
        errors.slice(0, 3).forEach((item, i) => {
          console.error(`  错误 ${i + 1}:`, item.index.error.reason);
        });
        
        if (errors.length > 3) {
          console.error(`  ... 还有 ${errors.length - 3} 个错误`);
        }
        
        return {
          success: false,
          count: response.items.length - errors.length,
          errors: errors.length,
          total: response.items.length
        };
      } else {
        console.log(`✅ 成功索引 ${response.items.length} 个文档到 ${indexName}`);
        return {
          success: true,
          count: response.items.length,
          errors: 0,
          total: response.items.length
        };
      }
    } catch (error) {
      console.error('❌ 批量索引失败:', error.message);
      return {
        success: false,
        count: 0,
        errors: documents.length,
        total: documents.length,
        error: error.message
      };
    }
  }

  /**
   * 索引单个文档
   * @param {string} indexName - 索引名称
   * @param {Object} document - 文档对象
   * @param {string} id - 文档ID（可选）
   */
  async indexDocument(indexName, document, id = null) {
    try {
      const options = {
        index: indexName,
        body: document
      };
      
      if (id) {
        options.id = id;
      }
      
      const response = await this.client.index(options);
      return { success: true, id: response._id };
    } catch (error) {
      console.error('❌ 索引文档失败:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 搜索文档
   * @param {string} indexName - 索引名称
   * @param {Object} query - Elasticsearch 查询
   */
  async search(indexName, query) {
    try {
      const response = await this.client.search({
        index: indexName,
        body: query
      });
      return response.hits.hits.map(hit => hit._source);
    } catch (error) {
      console.error('❌ 搜索失败:', error.message);
      return [];
    }
  }

  /**
   * 获取索引统计信息
   * @param {string} indexName - 索引名称
   */
  async getIndexStats(indexName) {
    try {
      const response = await this.client.indices.stats({ index: indexName });
      return response.indices[indexName];
    } catch (error) {
      console.error('❌ 获取索引统计失败:', error.message);
      return null;
    }
  }

  /**
   * 删除索引
   * @param {string} indexName - 索引名称
   */
  async deleteIndex(indexName) {
    try {
      await this.client.indices.delete({ index: indexName });
      console.log(`✅ 删除索引: ${indexName}`);
      return true;
    } catch (error) {
      console.error(`❌ 删除索引失败 (${indexName}):`, error.message);
      return false;
    }
  }
}

module.exports = ElasticsearchClient;
