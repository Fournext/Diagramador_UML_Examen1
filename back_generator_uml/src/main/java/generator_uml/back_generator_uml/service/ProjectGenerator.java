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
        Path srcMain = root.resolve("src/main/java/" + basePackage.replace(".","/"));
        Path srcRes  = root.resolve("src/main/resources");
        Files.createDirectories(srcMain);
        Files.createDirectories(srcRes);

        // Generar pom.xml, Application.java, etc. con templates
        render("pom.mustache", Map.of("groupId", "com.example",
                        "artifactId", artifactId,
                        "basePackage", basePackage),
                root.resolve("pom.xml"));

        render("Application.mustache", Map.of("basePackage", basePackage),
                srcMain.resolve("GenAppApplication.java"));

        // Carpetas para entity, repo, service, controller
        Path modelDir = srcMain.resolve("model");
        Path repoDir  = srcMain.resolve("repository");
        Path svcDir   = srcMain.resolve("generator_uml/back_generator_uml/service");
        Path ctrlDir  = srcMain.resolve("generator_uml/back_generator_uml/controller");
        Files.createDirectories(modelDir);
        Files.createDirectories(repoDir);
        Files.createDirectories(svcDir);
        Files.createDirectories(ctrlDir);

        for (UmlClass c : schema.getClasses()) {
            String entityName = NamingUtil.toJavaClass(c.getName());
            List<Map<String, Object>> attrs = new ArrayList<>();
            for (var attr : c.getAttributes()) {
                Map<String, Object> a = new HashMap<>();
                a.put("name", attr.getName());
                a.put("type", TypeMapper.toJava(attr.getType())); // ✅ convierte a tipo válido
                a.put("isId", attr.getName().equalsIgnoreCase("id"));
                attrs.add(a);
            }

            render("Entity.mustache", Map.of(
                    "basePackage", basePackage,
                    "EntityName", entityName,
                    "attributes", attrs
            ), modelDir.resolve(entityName + ".java"));

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

