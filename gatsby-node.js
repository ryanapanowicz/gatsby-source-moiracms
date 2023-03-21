const {
    ApolloClient,
    InMemoryCache,
    gql,
    createHttpLink,
} = require("@apollo/client");
const fetch = require("cross-fetch");
const { createRemoteFileNode } = require("gatsby-source-filesystem");

// constants for your GraphQL Project type
const PROJECT_NODE_TYPE = `Project`;
const ASSET_NODE_TYPE = `Asset`;

// Set limit to a unlikely amount to prevent default pagination
const QUERY_ITEM_LIMIT = 9999;

const client = new ApolloClient({
    link: createHttpLink({ uri: "http://127.0.0.1:8000/graphql", fetch }),
    cache: new InMemoryCache(),
});

// called each time a node is created
exports.onCreateNode = async ({
    node,
    actions: { createNode, createNodeField },
    store,
    getCache,
    createNodeId,
}) => {
    if (node.internal.type === ASSET_NODE_TYPE) {
        const fileNode = await createRemoteFileNode({
            url: node.url,
            parentNodeId: node.id,
            store,
            getCache,
            createNode,
            createNodeId,
        });

        if (fileNode) {
            createNodeField({
                node,
                name: "localFile",
                value: fileNode.id,
            });
        }
    }
};

exports.sourceNodes = async ({ actions, createContentDigest }) => {
    const { createNode } = actions;
    const { data } = await client.query({
        query: gql`
            query {
                projects(first: ${QUERY_ITEM_LIMIT}) {
                    data {
                        id
                        title
                        subtitle
                        slug
                        content
                        featured {
                            id
                        }
                        link
                        work_done
                        built_with
                        keywords
                        description
                        start
                        end
                        assets {
                            id
                        }
                        created_at
                        updated_at
                    }
                }
                assets(first: ${QUERY_ITEM_LIMIT}) {
                    data {
                        id
                        name
                        file_name
                        url
                        preview
                        responsive_images {
                            urls
                            base64svg
                        }
                        type
                        extension
                        mime_type
                        size
                        alternative_text
                        caption
                        created_at
                        updated_at
                    }
                }
            }
        `,
    });

    // loop through data and create Gatsby nodes
    data.projects?.data.forEach((project) => {
        Object.keys(project).map((key, index) => {
            if (project[key] == null) {
                project[key] = "";
            }
        });
        return createNode({
            ...project,
            id: project.id,
            parent: null,
            children: [],
            internal: {
                type: PROJECT_NODE_TYPE,
                content: JSON.stringify(project),
                contentDigest: createContentDigest(project),
            },
        });
    });

    data.assets?.data.forEach((asset) =>
        createNode({
            ...asset,
            id: asset.id,
            parent: null,
            children: [],
            internal: {
                type: ASSET_NODE_TYPE,
                content: JSON.stringify(asset),
                contentDigest: createContentDigest(asset),
            },
        })
    );

    return;
};

exports.createSchemaCustomization = ({ actions, schema }) => {
    const { createTypes } = actions;
    createTypes([
        `type ResposiveImage implements Node @dontInfer {
            urls: [String]
            base64svg: String
        }`,
        `type Asset implements Node @dontInfer {
            id: ID!
            localFile: File @link(from: "fields.localFile")
            name: String!
            file_name: String!
            url: String!
            preview: String!
            responsive_images: [ResposiveImage]
            type: String!
            extension: String
            mime_type: String!
            size: Float!
            alternative_text: String
            caption: String
            created_at: Date!
            updated_at: Date!
        }`,
        schema.buildObjectType({
            name: PROJECT_NODE_TYPE,
            fields: {
                id: "ID!",
                title: "String!",
                subtitle: "String!",
                slug: "String!",
                content: "String",
                featured: {
                    type: ASSET_NODE_TYPE,
                    resolve: (source, args, context, info) => {
                        return context.nodeModel.getNodeById({
                            type: ASSET_NODE_TYPE,
                            id: source.featured.id,
                        });
                    },
                },
                link: "String",
                work_done: "String",
                built_with: "[String]",
                keywords: "[String]",
                description: "String",
                start: "Date",
                end: "Date",
                created_at: "Date!",
                updated_at: "Date!",
                assets: {
                    type: `[${ASSET_NODE_TYPE}]`,
                    resolve: (source, args, context, info) => {
                        return context.nodeModel.getNodesByIds({
                            type: ASSET_NODE_TYPE,
                            ids: source.assets.flatMap((asset) => asset.id),
                        });
                    },
                },
            },
            interfaces: ["Node"],
            extensions: {
                infer: false,
            },
        }),
    ]);
};
