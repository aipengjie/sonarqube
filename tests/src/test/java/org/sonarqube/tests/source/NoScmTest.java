/*
 * SonarQube
 * Copyright (C) 2009-2018 SonarSource SA
 * mailto:info AT sonarsource DOT com
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */
package org.sonarqube.tests.source;

import com.sonar.orchestrator.Orchestrator;
import com.sonar.orchestrator.build.BuildResult;
import com.sonar.orchestrator.build.SonarScanner;
import java.io.File;
import java.io.IOException;
import java.text.ParseException;
import java.util.Date;
import java.util.Map;
import org.junit.ClassRule;
import org.junit.Ignore;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import org.sonarqube.qa.util.Tester;

import static org.apache.commons.io.FileUtils.copyDirectory;
import static org.apache.commons.io.FileUtils.moveFile;
import static org.assertj.core.api.Assertions.assertThat;
import static org.sonarqube.tests.source.SourceSuite.ORCHESTRATOR;
import static util.ItUtils.projectDir;

// FIXME GJT : functional test
// FIXME GJT : refactor common parts w ScmTest
// FIXME GJT : assert on measures + new code measure (nb of new lines)

public class NoScmTest {

  @ClassRule
  public static Orchestrator orchestrator = ORCHESTRATOR;
  private SourceScmWS ws = new SourceScmWS(orchestrator);

  @Rule
  public TemporaryFolder temporaryFolder = new TemporaryFolder();

  @Rule
  public Tester tester = new Tester(orchestrator);

  @Test
  public void two_analysis_without_scm() throws ParseException, IOException {

    File origin = projectDir("scm/xoo-sample-without-scm");
    copyDirectory(origin.getParentFile(), temporaryFolder.getRoot());
    File source = new File(temporaryFolder.getRoot(), "xoo-sample-without-scm");

    SonarScanner build = SonarScanner.create(source);

    // First run
    orchestrator.executeBuild(build);
    Map<Integer, LineData> scmData = ws.getScmData("sample-without-scm:src/main/xoo/sample/Sample.xoo");

    assertThat(scmData.size()).isEqualTo(1);
    assertThat(scmData.get(1).revision).isEmpty();
    assertThat(scmData.get(1).author).isEmpty();
    assertThat(scmData.get(1).date).isInSameMinuteWindowAs(new Date());

    // Swap Files
    File sample = new File(source, "src/main/xoo/sample/Sample.xoo");
    sample.delete();
    moveFile(new File(source, "src/main/xoo/sample/Sample.xoo.new"), sample);

    // 2nd run
    orchestrator.executeBuild(build);
    scmData = ws.getScmData("sample-without-scm:src/main/xoo/sample/Sample.xoo");

    assertThat(scmData.size()).isEqualTo(4);
    assertThat(scmData.get(1).revision).isEmpty();
    assertThat(scmData.get(1).author).isEmpty();
    assertThat(scmData.get(1).date).isInSameMinuteWindowAs(new Date());

    assertThat(scmData.get(5).revision).isEmpty();
    assertThat(scmData.get(5).author).isEmpty();
    assertThat(scmData.get(5).date).isAfter(scmData.get(1).date);

  }

  @Test
  @Ignore
  public void analysis_with_and_then_without_scm() throws ParseException, IOException {

    File origin = projectDir("scm/xoo-sample-with-without-scm");
    copyDirectory(origin.getParentFile(), temporaryFolder.getRoot());
    File source = new File(temporaryFolder.getRoot(), "xoo-sample-without-scm");

    SonarScanner build = SonarScanner.create(source);

    // First run
    BuildResult buildResult = orchestrator.executeBuild(build);
    Map<Integer, LineData> scmData = ws.getScmData("sample-scm:src/main/xoo/sample/Sample.xoo");

    // Swap Files
    File sample = new File(source, "src/main/xoo/sample/Sample.xoo");
    sample.delete();
    moveFile(new File(source, "src/main/xoo/sample/Sample.xoo.new"), sample);

    // 2nd run
    buildResult = orchestrator.executeBuild(build);
    scmData = ws.getScmData("sample-scm:src/main/xoo/sample/Sample.xoo");

  }

}
