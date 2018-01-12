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
package org.sonar.server.computation.task.projectanalysis.scm;

import java.util.Comparator;
import java.util.Map;
import java.util.stream.Collectors;
import javax.annotation.CheckForNull;
import javax.annotation.concurrent.Immutable;

@Immutable
public class ScmInfoImpl implements ScmInfo {

  @CheckForNull
  private final Changeset latestChangeset;
  private final Map<Integer, Changeset> lineChangesets;

  public ScmInfoImpl(Map<Integer, Changeset> lineChangesets) {
    this.lineChangesets = lineChangesets;
    this.latestChangeset = computeLatestChangeset(lineChangesets);
  }

  private static Changeset computeLatestChangeset(Map<Integer, Changeset> lineChangesets) {
    return lineChangesets.values().stream()
      .collect(Collectors.maxBy(Comparator.comparing(Changeset::getDate)))
      .orElse(null);
  }

  @Override
  public Changeset getLatestChangeset() {
    return latestChangeset;
  }

  @Override
  public Changeset getChangesetForLine(int lineNumber) {
    Changeset changeset = lineChangesets.get(lineNumber);
    if (changeset != null) {
      return changeset;
    }
    throw new IllegalArgumentException("Line " + lineNumber + " doesn't have a changeset");
  }

  @Override
  public boolean hasChangesetForLine(int lineNumber) {
    return lineChangesets.containsKey(lineNumber);
  }

  @Override
  public Map<Integer, Changeset> getAllChangesets() {
    return lineChangesets;
  }

  @Override
  public String toString() {
    return "ScmInfoImpl{" +
      "latestChangeset=" + latestChangeset +
      ", lineChangesets=" + lineChangesets +
      '}';
  }
}
