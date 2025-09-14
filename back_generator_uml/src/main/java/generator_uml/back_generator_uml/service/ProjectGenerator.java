package generator_uml.back_generator_uml.service;

import com.github.mustachejava.Mustache;
import com.github.mustachejava.MustacheFactory;
import generator_uml.back_generator_uml.entity.UmlClass;
import generator_uml.back_generator_uml.entity.UmlSchema;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.zeroturnaround.zip.ZipUtil;

import java.io.*;
import java.nio.file.*;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ProjectGenerator {

    private final MustacheFactory mustacheFactory;

    public Path generate(UmlSchema schema, String basePackage, String artifactId) throws Exception {
        Path root = Files.createTempDirectory("gen-" + artifactId);
        Path srcMain = root.resolve("src/main/java/" + basePackage.replace(".", "/"));
        Path srcRes = root.resolve("src/main/resources");
        Files.createDirectories(srcMain);
        Files.createDirectories(srcRes);

        // Generar pom.xml y Application.java
        render("pom.mustache", Map.of(
                "groupId", "com.example",
                "artifactId", artifactId,
                "basePackage", basePackage
        ), root.resolve("pom.xml"));

        render("Application.mustache", Map.of("basePackage", basePackage),
                srcMain.resolve("GenAppApplication.java"));

        // Generar application.properties
        Map<String, Object> props = Map.of(
                "serverPort", 9000,
                "dbHost", "localhost",
                "dbPort", "5432",
                "dbName", "mi_base",
                "dbUser", "postgres",
                "dbPassword", "123456",
                "dbDriver", "org.postgresql.Driver",
                "dbDialect", "org.hibernate.dialect.PostgreSQLDialect"
        );
        render("application-properties.mustache", props, srcRes.resolve("application.properties"));

        // Carpetas para entity, repo, service, controller
        Path modelDir = srcMain.resolve("model");
        Path repoDir = srcMain.resolve("repository");
        Path svcDir = srcMain.resolve("service");
        Path ctrlDir = srcMain.resolve("controller");
        Files.createDirectories(modelDir);
        Files.createDirectories(repoDir);
        Files.createDirectories(svcDir);
        Files.createDirectories(ctrlDir);

        // Procesar clases
        for (UmlClass c : schema.getClasses()) {
            String entityName = NamingUtil.toJavaClass(c.getName());

            // Atributos
            List<Map<String, Object>> attrs = new ArrayList<>();
            for (var attr : c.getAttributes()) {
                Map<String, Object> a = new HashMap<>();
                a.put("name", attr.getName());
                a.put("type", TypeMapper.toJava(attr.getType()));
                a.put("isId", attr.getName().equalsIgnoreCase("id"));
                attrs.add(a);
            }

            // Relaciones
            List<Map<String, Object>> oneToMany = new ArrayList<>();
            List<Map<String, Object>> manyToOne = new ArrayList<>();
            List<Map<String, Object>> oneToOne = new ArrayList<>();
            List<Map<String, Object>> manyToMany = new ArrayList<>();
            String parentClass = null;

            if (schema.getRelationships() != null) {
                for (var rel : schema.getRelationships()) {
                    String sourceName = schema.getClasses().stream()
                            .filter(cl -> cl.getId().equals(rel.getSourceId()))
                            .map(UmlClass::getName)
                            .findFirst().orElse(null);

                    String targetName = schema.getClasses().stream()
                            .filter(cl -> cl.getId().equals(rel.getTargetId()))
                            .map(UmlClass::getName)
                            .findFirst().orElse(null);

                    if (sourceName == null || targetName == null) continue;

                    String sourceEntity = NamingUtil.toJavaClass(sourceName);
                    String targetEntity = NamingUtil.toJavaClass(targetName);

                    // ---- Generalization (Herencia) ----
                    if ("generalization".equals(rel.getType()) && rel.getSourceId().equals(c.getId())) {
                        parentClass = targetEntity;
                    }

                    // ---- Asociaciones ----
                    if ("association".equals(rel.getType()) || "aggregation".equals(rel.getType()) || "composition".equals(rel.getType())) {
                        boolean sourceIsMany = rel.getLabels().stream().findFirst().orElse("1").contains("*");
                        boolean targetIsMany = rel.getLabels().size() > 1 && rel.getLabels().get(1).contains("*");

                        // Fuente = esta clase
                        if (c.getName().equals(sourceName)) {
                            if (!sourceIsMany && targetIsMany) {
                                // OneToMany
                                oneToMany.add(Map.of(
                                        "TargetEntity", targetEntity,
                                        "collectionField", NamingUtil.plural(NamingUtil.toField(targetEntity)),
                                        "mappedBy", NamingUtil.toField(sourceEntity)
                                ));
                            } else if (!sourceIsMany && !targetIsMany) {
                                // OneToOne
                                oneToOne.add(Map.of(
                                        "TargetEntity", targetEntity,
                                        "targetField", NamingUtil.toField(targetEntity)
                                ));
                            } else if (sourceIsMany && targetIsMany) {
                                // ManyToMany
                                manyToMany.add(Map.of(
                                        "TargetEntity", targetEntity,
                                        "collectionField", NamingUtil.plural(NamingUtil.toField(targetEntity)),
                                        "joinTable", sourceEntity.toLowerCase() + "_" + targetEntity.toLowerCase(),
                                        "thisTable", sourceEntity.toLowerCase(),
                                        "otherTable", targetEntity.toLowerCase()
                                ));
                            }
                        }

                        // Target = esta clase
                        if (c.getName().equals(targetName) && targetIsMany) {
                            manyToOne.add(Map.of(
                                    "TargetEntity", sourceEntity,
                                    "targetField", NamingUtil.toField(sourceEntity)
                            ));
                        }
                    }
                }
            }

            // Contexto para la entidad
            Map<String, Object> entityCtx = new HashMap<>();
            entityCtx.put("basePackage", basePackage);
            entityCtx.put("EntityName", entityName);
            entityCtx.put("attributes", attrs);
            entityCtx.put("oneToMany", oneToMany);
            entityCtx.put("manyToOne", manyToOne);
            entityCtx.put("oneToOne", oneToOne);
            entityCtx.put("manyToMany", manyToMany);
            entityCtx.put("parentClass", parentClass);

            // Render entidad
            render("Entity.mustache", entityCtx, modelDir.resolve(entityName + ".java"));

            // Render repository, service y controller
            render("Repository.mustache", Map.of("basePackage", basePackage, "EntityName", entityName),
                    repoDir.resolve(entityName + "Repository.java"));

            render("Service.mustache", Map.of("basePackage", basePackage, "EntityName", entityName),
                    svcDir.resolve(entityName + "Service.java"));

            render("Controller.mustache", Map.of(
                    "basePackage", basePackage,
                    "EntityName", entityName,
                    "plural", NamingUtil.plural(NamingUtil.toField(entityName))
            ), ctrlDir.resolve(entityName + "Controller.java"));
        }

        Path zip = root.getParent().resolve(artifactId + ".zip");
        ZipUtil.pack(root.toFile(), zip.toFile());
        return zip;
    }

    private void render(String template, Map<String, Object> ctx, Path target) throws IOException {
        Mustache mustache = mustacheFactory.compile("templates/" + template);
        try (Writer w = new FileWriter(target.toFile())) {
            mustache.execute(w, ctx).flush();
        }
    }
}
